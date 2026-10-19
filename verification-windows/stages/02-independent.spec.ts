import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  const days = 1 + (Date.now() % 365);                                                       // 1〜365 のどれか。実行するたびに変わる
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);   // 例: '2027-03-15'
  await page.goto('https://se-college-demo.takuyasuemura.workers.dev/login');
  await page.getByRole('textbox', { name: 'ユーザーID' }).fill('tanaka');
  await page.getByRole('textbox', { name: 'パスワード' }).fill('pass1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.getByRole('link', { name: '新規予約' }).click();
  await page.getByLabel('会議室').selectOption('C');
  await page.getByRole('textbox', { name: '日付' }).fill(date);                              // ← 録画した '2031-03-12' をこれに変えた
  await page.getByLabel('開始時刻').selectOption('14:00');
  await page.getByLabel('終了時刻').selectOption('15:00');
  await page.getByRole('textbox', { name: '目的' }).fill('勉強会 win-ci');
  await page.getByRole('button', { name: '予約する' }).click();
  await expect(page.getByText('予約を登録しました')).toBeVisible();

  // 後処理: 作った予約をキャンセルする
  const row = page.getByRole('row', { name: date });                 // この日付の予約は自分のものだけ
  await row.getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByText('予約をキャンセルしました')).toBeVisible();
});
