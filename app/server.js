'use strict';

// ---------------------------------------------------------------
// 会議室予約システム（演習用サンプルアプリケーション）
//
//   npm start            -> http://localhost:3000 で起動
//   PORT=4000 npm start  -> ポートを変更して起動
//
// 外部ライブラリを使わず、Node.js 標準の http モジュールだけで動きます。
// データはメモリ上に保持され、再起動または「データを初期化」で初期状態に戻ります。
// ---------------------------------------------------------------

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  store,
  resetData,
  findUser,
  findReservation,
  addReservation,
  removeReservation,
  sortedReservations,
} = require('./store');
const { validateReservation } = require('./reservation');
const views = require('./views');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

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

function serveStatic(res, fileName) {
  const safeName = path.basename(fileName);
  const filePath = path.join(PUBLIC_DIR, safeName);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const type = safeName.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
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
    return serveStatic(res, pathname.slice('/public/'.length));
  }

  // 開発・テスト用 API
  if (pathname === '/api/reset' && method === 'POST') {
    resetData();
    return sendJson(res, { ok: true });
  }
  if (pathname === '/api/reservations' && method === 'GET') {
    return sendJson(res, sortedReservations());
  }
  if (pathname === '/reset' && method === 'POST') {
    resetData();
    return redirect(res, '/?flash=reset');
  }

  // ログイン / ログアウト
  if (pathname === '/login' && method === 'GET') {
    if (user) return redirect(res, '/');
    return sendHtml(res, views.loginPage({ flash: url.searchParams.get('flash') }));
  }
  if (pathname === '/login' && method === 'POST') {
    const form = await readForm(req);
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
    const form = await readForm(req);
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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`会議室予約システムを起動しました: http://localhost:${PORT}`);
  console.log('終了するには Ctrl + C を押してください');
});
