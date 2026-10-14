'use strict';

// ---------------------------------------------------------------
// 新規登録（サインアップ）の入力チェック
// ---------------------------------------------------------------

const { findUser } = require('./store');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * フォームの入力値を検証する。
 * 戻り値: { errors: string[], values: { name, email, password } }
 */
function validateSignup(input) {
  const errors = [];
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (name === '') {
    errors.push('名前を入力してください');
  }
  if (!EMAIL_PATTERN.test(email)) {
    errors.push('メールアドレスを正しく入力してください');
  } else if (findUser(email)) {
    errors.push('このメールアドレスはすでに登録されています');
  }
  if (password.length < 8) {
    errors.push('パスワードは8文字以上で入力してください');
  }

  return { errors, values: { name, email, password } };
}

module.exports = { validateSignup };
