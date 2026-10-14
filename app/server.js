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
  signUp,
  findUser,
  workspaceOf,
  findReservation,
  addReservation,
  removeReservation,
  sortedReservations,
} = require('./store');
const { validateReservation } = require('./reservation');
const { validateSignup } = require('./account');
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

function readForm(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(body))));
    req.on('error', reject);
  });
}

function sendHtml(res, html, status = 200, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function startSession(res, userId, location) {
  const sid = crypto.randomBytes(16).toString('hex');
  store.sessions.set(sid, userId);
  return redirect(res, location, { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly; SameSite=Lax` });
}

function currentUser(req) {
  const { sid } = parseCookies(req);
  const userId = sid && store.sessions.get(sid);
  return userId ? findUser(userId) : null;
}

function ownerName(userId) {
  const owner = findUser(userId);
  return owner ? owner.name : userId;
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

  // 新規登録
  if (pathname === '/signup' && method === 'GET') {
    if (user) return redirect(res, '/');
    return sendHtml(res, views.signupPage());
  }
  if (pathname === '/signup' && method === 'POST') {
    const form = await readForm(req);
    const { errors, values } = validateSignup(form);
    if (errors.length > 0) {
      return sendHtml(res, views.signupPage({ values, errors }), 400);
    }
    const created = signUp(values);
    return startSession(res, created.id, '/?flash=signed-up');
  }

  // ログイン / ログアウト
  if (pathname === '/login' && method === 'GET') {
    if (user) return redirect(res, '/');
    return sendHtml(res, views.loginPage({ flash: url.searchParams.get('flash') }));
  }
  if (pathname === '/login' && method === 'POST') {
    const form = await readForm(req);
    const found = findUser(String(form.userId || '').trim().toLowerCase()) || findUser(String(form.userId || ''));
    if (!found || !found.password || found.password !== String(form.password || '')) {
      return sendHtml(
        res,
        views.loginPage({ error: 'ユーザーIDまたはパスワードが正しくありません', userId: form.userId }),
      );
    }
    return startSession(res, found.id, '/');
  }
  if (pathname === '/logout' && method === 'POST') {
    const { sid } = parseCookies(req);
    if (sid) store.sessions.delete(sid);
    return redirect(res, '/login?flash=logged-out', {
      'Set-Cookie': 'sid=; Path=/; Max-Age=0',
    });
  }

  // ここから先はログインが必要
  if (!user) {
    return redirect(res, '/login');
  }
  const workspace = workspaceOf(user);

  if (pathname === '/' && method === 'GET') {
    return sendHtml(
      res,
      views.listPage({
        user,
        flash: url.searchParams.get('flash'),
        reservations: sortedReservations(workspace),
        rooms: store.rooms,
        ownerName,
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
    const form = await readForm(req);
    const { errors, reservation } = validateReservation(form, workspace);
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
    addReservation(workspace, { ...reservation, userId: user.id });
    return redirect(res, '/?flash=created');
  }

  const cancelMatch = pathname.match(/^\/reservations\/(\d+)\/cancel$/);
  if (cancelMatch && method === 'POST') {
    const reservation = findReservation(workspace, Number(cancelMatch[1]));
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
    removeReservation(workspace, reservation.id);
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
