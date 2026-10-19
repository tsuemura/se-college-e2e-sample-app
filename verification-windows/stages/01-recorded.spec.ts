import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://se-college-demo.takuyasuemura.workers.dev/login');
  await page.getByRole('textbox', { name: 'ユーザーID' }).fill('tanaka');
  await page.getByRole('textbox', { name: 'パスワード' }).fill('pass1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.getByRole('link', { name: '新規予約' }).click();
  await page.getByLabel('会議室').selectOption('C');                    // ← ここから 4 行は自分が選んだ値
  await page.getByRole('textbox', { name: '日付' }).fill('2031-03-12');
  await page.getByLabel('開始時刻').selectOption('14:00');
  await page.getByLabel('終了時刻').selectOption('15:00');
  await page.getByRole('textbox', { name: '目的' }).fill('勉強会 win-ci');
  await page.getByRole('button', { name: '予約する' }).click();
  await expect(page.getByText('予約を登録しました')).toBeVisible();   // ← Assert visibility で記録した検証
});
