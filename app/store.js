'use strict';

// ---------------------------------------------------------------
// インメモリのデータストア
// サーバーを再起動するか、POST /api/reset を呼ぶと初期データに戻ります。
// ---------------------------------------------------------------

const USERS = [
  { id: 'tanaka', password: 'pass1234', name: '田中 太郎' },
  { id: 'suzuki', password: 'pass1234', name: '鈴木 花子' },
];

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

function seedReservations() {
  return [
    {
      id: 1,
      roomId: 'A',
      date: '2030-04-01',
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'プロジェクト定例',
      participants: 5,
      userId: 'tanaka',
    },
    {
      id: 2,
      roomId: 'B',
      date: '2030-04-01',
      startTime: '13:00',
      endTime: '15:00',
      purpose: '採用面接',
      participants: 3,
      userId: 'suzuki',
    },
  ];
}

const store = {
  users: USERS,
  rooms: ROOMS,
  timeSlots: TIME_SLOTS,
  reservations: seedReservations(),
  nextReservationId: 3,
  sessions: new Map(), // sessionId -> userId
};

function resetData() {
  store.reservations = seedReservations();
  store.nextReservationId = 3;
}

function findUser(userId) {
  return store.users.find((u) => u.id === userId);
}

function findRoom(roomId) {
  return store.rooms.find((r) => r.id === roomId);
}

function findReservation(id) {
  return store.reservations.find((r) => r.id === id);
}

function addReservation(reservation) {
  const saved = { id: store.nextReservationId++, ...reservation };
  store.reservations.push(saved);
  return saved;
}

function removeReservation(id) {
  store.reservations = store.reservations.filter((r) => r.id !== id);
}

function sortedReservations() {
  return [...store.reservations].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0;
  });
}

module.exports = {
  store,
  resetData,
  findUser,
  findRoom,
  findReservation,
  addReservation,
  removeReservation,
  sortedReservations,
};
