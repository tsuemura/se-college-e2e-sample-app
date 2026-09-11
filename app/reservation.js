'use strict';

// ---------------------------------------------------------------
// 予約の入力チェック（業務ルール）
// ---------------------------------------------------------------

const { store, findRoom } = require('./store');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 同じ会議室・同じ日付で時間帯が重なっている予約を探す。
 * 見つからなければ undefined を返す。
 */
function findConflict(reservations, roomId, date, startTime, endTime) {
  return reservations.find(
    (r) =>
      r.roomId === roomId &&
      r.date === date &&
      startTime < r.endTime &&
      endTime > r.startTime,
  );
}

/**
 * フォームの入力値を検証する。
 * 戻り値: { errors: string[], reservation: object | null }
 */
function validateReservation(input) {
  const errors = [];
  const roomId = String(input.roomId || '');
  const date = String(input.date || '');
  const startTime = String(input.startTime || '');
  const endTime = String(input.endTime || '');
  const purpose = String(input.purpose || '').trim();
  const participants = Number(input.participants);

  const room = findRoom(roomId);
  if (!room) {
    errors.push('会議室を選択してください');
  }
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(date))) {
    errors.push('日付を入力してください');
  }
  if (!store.timeSlots.includes(startTime) || !store.timeSlots.includes(endTime)) {
    errors.push('開始時刻と終了時刻を選択してください');
  } else if (endTime <= startTime) {
    errors.push('終了時刻は開始時刻より後にしてください');
  }
  if (purpose === '') {
    errors.push('目的を入力してください');
  }
  if (!Number.isInteger(participants) || participants < 1) {
    errors.push('参加人数は1以上の整数で入力してください');
  } else if (room && participants > room.capacity) {
    errors.push(`参加人数が会議室の定員（${room.capacity}名）を超えています`);
  }

  if (errors.length === 0) {
    const conflict = findConflict(store.reservations, roomId, date, startTime, endTime);
    if (conflict) {
      errors.push('指定した時間帯はすでに予約されています');
    }
  }

  if (errors.length > 0) {
    return { errors, reservation: null };
  }
  return {
    errors: [],
    reservation: { roomId, date, startTime, endTime, purpose, participants },
  };
}

module.exports = { validateReservation, findConflict };
