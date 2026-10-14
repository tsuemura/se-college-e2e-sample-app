'use strict';

// ---------------------------------------------------------------
// 会議室予約システム（演習用サンプルアプリケーション）
//
//   npm start                 -> http://localhost:3000 で起動
//   PORT=4000 npm start       -> ポートを変更して起動
//   HOST=0.0.0.0 npm start    -> 他のマシンからも接続できるようにする（コンテナなど）
//
// 外部ライブラリを使わず、Node.js 標準の http モジュールだけで動きます。
// データはメモリ上に保持され、再起動すると初期状態に戻ります。
// ---------------------------------------------------------------

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  store,
  findUser,
  findReservation,
  addReservation,
  removeReservation,
  sortedReservations,
} = require('./store');
const { validateReservation } = require('./reservation');
const markdown = require('./markdown');
const views = require('./views');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DOCS_DIR = path.join(__dirname, '..', 'docs');

// ---- 小さなユーティリティ ---------------------------------------

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// フォーム（application/x-www-form-urlencoded）と JSON のどちらでも受け取る
async function readInput(req) {
  const body = await readBody(req);
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) {
    try {
      return JSON.parse(body || '{}');
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(body));
}

function sendHtml(res, html, status = 200, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function currentUser(req) {
  const { sid } = parseCookies(req);
  const userId = sid && store.sessions.get(sid);
  return userId ? findUser(userId) : null;
}

function serveFile(res, dir, fileName, types) {
  const safeName = path.basename(fileName);
  const filePath = path.join(dir, safeName);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(safeName);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---- ルーティング ------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { method } = req;
  const pathname = url.pathname;
  const user = currentUser(req);

  // 静的ファイル
  if (method === 'GET' && pathname.startsWith('/public/')) {
    return serveFile(res, PUBLIC_DIR, pathname.slice('/public/'.length), { '.css': 'text/css; charset=utf-8' });
  }
  if (method === 'GET' && pathname.startsWith('/docs/images/')) {
    return serveFile(res, path.join(DOCS_DIR, 'images'), pathname.slice('/docs/images/'.length), { '.png': 'image/png' });
  }

  // 仕様書・マニュアル（docs/*.md を画面で読めるようにする）
  const docMatch = pathname.match(/^\/docs\/([a-z0-9-]+)$/);
  if (docMatch && method === 'GET') {
    const file = path.join(DOCS_DIR, `${docMatch[1]}.md`);
    if (!fs.existsSync(file)) {
      return sendHtml(res, views.messagePage({ user, title: 'ページが見つかりません', message: `${pathname} は存在しません。` }), 404);
    }
    const text = fs.readFileSync(file, 'utf8');
    const title = (text.match(/^#\s+(.+)$/m) || [, docMatch[1]])[1];
    return sendHtml(res, views.docPage({ user, title, html: markdown.render(text) }));
  }

  // ログイン / ログアウト
  if (pathname === '/login' && method === 'GET') {
    if (user) return redirect(res, '/');
    return sendHtml(res, views.loginPage({ flash: url.searchParams.get('flash') }));
  }
  if (pathname === '/login' && method === 'POST') {
    const form = await readInput(req);
    const found = findUser(String(form.userId || ''));
    if (!found || found.password !== String(form.password || '')) {
      return sendHtml(
        res,
        views.loginPage({ error: 'ユーザーIDまたはパスワードが正しくありません', userId: form.userId }),
      );
    }
    const sid = crypto.randomBytes(16).toString('hex');
    store.sessions.set(sid, found.id);
    return redirect(res, '/', { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly; SameSite=Lax` });
  }
  if (pathname === '/logout' && method === 'POST') {
    const { sid } = parseCookies(req);
    if (sid) store.sessions.delete(sid);
    return redirect(res, '/login?flash=logged-out', {
      'Set-Cookie': 'sid=; Path=/; Max-Age=0',
    });
  }

  // ---- JSON API（ログインが必要。画面と同じ業務ルールで動く） ----
  if (pathname.startsWith('/api/')) {
    if (!user) return sendJson(res, { error: 'ログインが必要です' }, 401);

    if (pathname === '/api/reservations' && method === 'GET') {
      return sendJson(res, sortedReservations());
    }
    if (pathname === '/api/reservations' && method === 'POST') {
      const input = await readInput(req);
      const { errors, reservation } = validateReservation(input);
      if (errors.length > 0) return sendJson(res, { errors }, 400);
      const saved = addReservation({ ...reservation, userId: user.id });
      return sendJson(res, saved, 201);
    }
    const apiCancel = pathname.match(/^\/api\/reservations\/(\d+)$/);
    if (apiCancel && method === 'DELETE') {
      const reservation = findReservation(Number(apiCancel[1]));
      if (!reservation) return sendJson(res, { error: '予約が見つかりません' }, 404);
      if (reservation.userId !== user.id) return sendJson(res, { error: '他のユーザーの予約はキャンセルできません' }, 403);
      removeReservation(reservation.id);
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { error: `${pathname} は存在しません` }, 404);
  }

  // ここから先はログインが必要
  if (!user) {
    return redirect(res, '/login');
  }

  if (pathname === '/' && method === 'GET') {
    return sendHtml(
      res,
      views.listPage({
        user,
        flash: url.searchParams.get('flash'),
        reservations: sortedReservations(),
        rooms: store.rooms,
        users: store.users,
      }),
    );
  }

  if (pathname === '/reservations/new' && method === 'GET') {
    return sendHtml(
      res,
      views.newReservationPage({ user, rooms: store.rooms, timeSlots: store.timeSlots }),
    );
  }

  if (pathname === '/reservations' && method === 'POST') {
    const form = await readInput(req);
    const { errors, reservation } = validateReservation(form);
    if (errors.length > 0) {
      return sendHtml(
        res,
        views.newReservationPage({
          user,
          rooms: store.rooms,
          timeSlots: store.timeSlots,
          values: form,
          errors,
        }),
        400,
      );
    }
    addReservation({ ...reservation, userId: user.id });
    return redirect(res, '/?flash=created');
  }

  const cancelMatch = pathname.match(/^\/reservations\/(\d+)\/cancel$/);
  if (cancelMatch && method === 'POST') {
    const reservation = findReservation(Number(cancelMatch[1]));
    if (!reservation) {
      return sendHtml(
        res,
        views.messagePage({ user, title: '予約が見つかりません', message: 'すでにキャンセルされた可能性があります。' }),
        404,
      );
    }
    if (reservation.userId !== user.id) {
      return sendHtml(
        res,
        views.messagePage({ user, title: 'キャンセルできません', message: '他のユーザーの予約はキャンセルできません。' }),
        403,
      );
    }
    removeReservation(reservation.id);
    return redirect(res, '/?flash=cancelled');
  }

  return sendHtml(
    res,
    views.messagePage({ user, title: 'ページが見つかりません', message: `${pathname} は存在しません。` }),
    404,
  );
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`会議室予約システムを起動しました: http://localhost:${PORT}`);
  console.log('終了するには Ctrl + C を押してください');
});
