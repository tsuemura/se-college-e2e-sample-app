'use strict';

// ---------------------------------------------------------------
// インメモリのデータストア
//
// 利用者はワークスペース（会社）に所属し、予約はワークスペースごとに分かれています。
//   - デモ用ワークスペース "demo": あらかじめ登録された田中さんと鈴木さんが所属
//   - 新規登録（サインアップ）すると新しいワークスペースが作られ、
//     サンプルの予約が入った状態で始まります
// データはサーバーのメモリ上に保持され、再起動すると初期状態に戻ります。
// ---------------------------------------------------------------

const ROOMS = [
  { id: 'A', name: '会議室A', capacity: 6 },
  { id: 'B', name: '会議室B', capacity: 10 },
  { id: 'C', name: '会議室C', capacity: 20 },
];

// 09:00 〜 18:00 を 30 分刻みで選択できる
const TIME_SLOTS = [];
for (let hour = 9; hour <= 18; hour++) {
  for (const minute of ['00', '30']) {
    if (hour === 18 && minute === '30') break;
    TIME_SLOTS.push(`${String(hour).padStart(2, '0')}:${minute}`);
  }
}

const store = {
  users: new Map(), // userId -> { id, name, password, workspaceId }
  workspaces: new Map(), // workspaceId -> { id, reservations, nextReservationId }
  rooms: ROOMS,
  timeSlots: TIME_SLOTS,
  sessions: new Map(), // sessionId -> userId
};

let nextWorkspaceNumber = 1;

function addUser(user) {
  store.users.set(user.id, user);
  return user;
}

// ワークスペースを作ったときに入っているサンプルの予約
function sampleReservations([owner1, owner2]) {
  return [
    {
      id: 1,
      roomId: 'A',
      date: '2030-04-01',
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'プロジェクト定例',
      userId: owner1,
    },
    {
      id: 2,
      roomId: 'B',
      date: '2030-04-01',
      startTime: '13:00',
      endTime: '15:00',
      purpose: '採用面接',
      userId: owner2,
    },
  ];
}

function createWorkspace(id, sampleOwnerIds) {
  const workspace = { id, reservations: sampleReservations(sampleOwnerIds), nextReservationId: 3 };
  store.workspaces.set(id, workspace);
  return workspace;
}

// デモ用ワークスペース（あらかじめ登録された利用者）
createWorkspace('demo', ['tanaka', 'suzuki']);
addUser({ id: 'tanaka', password: 'pass1234', name: '田中 太郎', workspaceId: 'demo' });
addUser({ id: 'suzuki', password: 'pass1234', name: '鈴木 花子', workspaceId: 'demo' });

/**
 * 新規登録: 新しいワークスペースを作り、利用者を登録する。
 * サンプルの予約は同僚（佐藤 一郎）の予約として入れる。ログインはできない。
 */
function signUp({ name, email, password }) {
  const workspaceId = `ws-${nextWorkspaceNumber++}`;
  const colleague = addUser({ id: `${workspaceId}:sato`, name: '佐藤 一郎', password: null, workspaceId });
  createWorkspace(workspaceId, [colleague.id, colleague.id]);
  return addUser({ id: email, name, password, workspaceId });
}

function findUser(userId) {
  return store.users.get(userId);
}

function findRoom(roomId) {
  return store.rooms.find((r) => r.id === roomId);
}

function workspaceOf(user) {
  return store.workspaces.get(user.workspaceId);
}

function findReservation(workspace, id) {
  return workspace.reservations.find((r) => r.id === id);
}

function addReservation(workspace, reservation) {
  const saved = { id: workspace.nextReservationId++, ...reservation };
  workspace.reservations.push(saved);
  return saved;
}

function removeReservation(workspace, id) {
  workspace.reservations = workspace.reservations.filter((r) => r.id !== id);
}

function sortedReservations(workspace) {
  return [...workspace.reservations].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0;
  });
}

module.exports = {
  store,
  signUp,
  findUser,
  findRoom,
  workspaceOf,
  findReservation,
  addReservation,
  removeReservation,
  sortedReservations,
};
