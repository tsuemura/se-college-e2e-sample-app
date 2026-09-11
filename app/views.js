'use strict';

// ---------------------------------------------------------------
// HTML テンプレート
// ---------------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FLASH_MESSAGES = {
  created: '予約を登録しました',
  cancelled: '予約をキャンセルしました',
  reset: 'データを初期化しました',
  'logged-out': 'ログアウトしました',
};

function layout({ title, user, flash, body }) {
  const nav = user
    ? `
      <nav class="nav">
        <a href="/">予約一覧</a>
      </nav>
      <div class="account">
        <span>ログイン中: ${escapeHtml(user.name)}</span>
        <form method="post" action="/logout" class="inline">
          <button type="submit">ログアウト</button>
        </form>
      </div>`
    : '';
  const flashHtml = flash && FLASH_MESSAGES[flash]
    ? `<p class="flash" role="status">${escapeHtml(FLASH_MESSAGES[flash])}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | 会議室予約システム</title>
  <link rel="stylesheet" href="/public/style.css">
</head>
<body>
  <header class="header">
    <h1><a href="/">会議室予約システム</a></h1>
    ${nav}
  </header>
  <main class="main">
    ${flashHtml}
    ${body}
  </main>
  <footer class="footer">
    <form method="post" action="/reset" class="inline">
      <button type="submit" class="secondary">データを初期化</button>
    </form>
  </footer>
</body>
</html>`;
}

function errorList(errors) {
  if (!errors || errors.length === 0) return '';
  const items = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('');
  return `<ul class="errors" role="alert">${items}</ul>`;
}

function loginPage({ error, userId = '', flash } = {}) {
  const body = `
    <h2>ログイン</h2>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    <form method="post" action="/login" class="form">
      <div class="field">
        <label for="userId">ユーザーID</label>
        <input id="userId" name="userId" type="text" value="${escapeHtml(userId)}" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="password">パスワード</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
      </div>
      <button type="submit">ログイン</button>
    </form>
    <aside class="hint">
      <p>デモ用アカウント（パスワードはどちらも <code>pass1234</code>）</p>
      <ul>
        <li><code>tanaka</code>（田中 太郎）</li>
        <li><code>suzuki</code>（鈴木 花子）</li>
      </ul>
    </aside>`;
  return layout({ title: 'ログイン', user: null, flash, body });
}

function reservationRow(reservation, { rooms, users, currentUser }) {
  const room = rooms.find((r) => r.id === reservation.roomId);
  const owner = users.find((u) => u.id === reservation.userId);
  const isOwner = currentUser && currentUser.id === reservation.userId;
  const cancelForm = isOwner
    ? `<form method="post" action="/reservations/${reservation.id}/cancel" class="inline">
         <button type="submit" class="danger">キャンセル</button>
       </form>`
    : '';
  return `
    <tr>
      <td>${escapeHtml(reservation.date)}</td>
      <td>${escapeHtml(reservation.startTime)}〜${escapeHtml(reservation.endTime)}</td>
      <td>${escapeHtml(room ? room.name : reservation.roomId)}</td>
      <td>${escapeHtml(reservation.participants)}名</td>
      <td>${escapeHtml(reservation.purpose)}</td>
      <td>${escapeHtml(owner ? owner.name : reservation.userId)}</td>
      <td>${cancelForm}</td>
    </tr>`;
}

function listPage({ user, flash, reservations, rooms, users }) {
  const rows = reservations
    .map((r) => reservationRow(r, { rooms, users, currentUser: user }))
    .join('');
  const table = reservations.length === 0
    ? '<p class="empty">予約はありません</p>'
    : `
    <table class="table">
      <thead>
        <tr>
          <th scope="col">日付</th>
          <th scope="col">時間</th>
          <th scope="col">会議室</th>
          <th scope="col">人数</th>
          <th scope="col">目的</th>
          <th scope="col">予約者</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  const body = `
    <h2>予約一覧</h2>
    <p><a href="/reservations/new" class="button">新規予約</a></p>
    ${table}`;
  return layout({ title: '予約一覧', user, flash, body });
}

function options(items, selected, labelOf) {
  return items
    .map((item) => {
      const value = typeof item === 'string' ? item : item.id;
      const label = labelOf ? labelOf(item) : value;
      const sel = value === selected ? ' selected' : '';
      return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function newReservationPage({ user, rooms, timeSlots, values = {}, errors = [] }) {
  const body = `
    <h2>新規予約</h2>
    ${errorList(errors)}
    <form method="post" action="/reservations" class="form">
      <div class="field">
        <label for="roomId">会議室</label>
        <select id="roomId" name="roomId" required>
          <option value="">選択してください</option>
          ${options(rooms, values.roomId, (r) => `${r.name}（定員${r.capacity}名）`)}
        </select>
      </div>
      <div class="field">
        <label for="date">日付</label>
        <input id="date" name="date" type="date" value="${escapeHtml(values.date || '')}" required>
      </div>
      <div class="field">
        <label for="startTime">開始時刻</label>
        <select id="startTime" name="startTime" required>
          <option value="">--:--</option>
          ${options(timeSlots, values.startTime)}
        </select>
      </div>
      <div class="field">
        <label for="endTime">終了時刻</label>
        <select id="endTime" name="endTime" required>
          <option value="">--:--</option>
          ${options(timeSlots, values.endTime)}
        </select>
      </div>
      <div class="field">
        <label for="participants">参加人数</label>
        <input id="participants" name="participants" type="number" value="${escapeHtml(values.participants ?? 1)}" min="1" required>
      </div>
      <div class="field">
        <label for="purpose">目的</label>
        <input id="purpose" name="purpose" type="text" value="${escapeHtml(values.purpose || '')}" maxlength="50" required>
      </div>
      <button type="submit">予約する</button>
      <a href="/" class="link">一覧に戻る</a>
    </form>`;
  return layout({ title: '新規予約', user, body });
}

function messagePage({ user, title, message }) {
  const body = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><p><a href="/">一覧に戻る</a></p>`;
  return layout({ title, user, body });
}

module.exports = { loginPage, listPage, newReservationPage, messagePage };
