import { test, expect, type Page } from '@playwright/test';
async function loginAsTanaka(page: Page) {                 // 「田中さんでログインする」手順に名前を付けた
  await page.goto('/login');                               // 設定に baseURL を書いたので、URL の先頭を省略できる
  await page.getByLabel('ユーザーID').fill('tanaka');
  await page.getByLabel('パスワード').fill('pass1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
}
test.describe('会議室の予約', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTanaka(page);                             // 各テストの前に実行される
  });
  test('会議室を予約すると一覧に表示される', async ({ page }) => {
    const days = 1 + (Date.now() % 365);                                                       // 1〜365 のどれか。実行するたびに変わる
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);   // 例: '2027-03-15'
    const purpose = `勉強会 win-ci ${Date.now()}`;                   // 目的。実行ごとに違う目印を付けておく
    await page.getByRole('link', { name: '新規予約' }).click();
    await expect(page.getByRole('heading', { name: '新規予約' })).toBeVisible();   // 画面が開けたことを確認してから入力する
    await page.getByLabel('会議室').selectOption('C');
    await page.getByLabel('日付').fill(date);
    await page.getByLabel('開始時刻').selectOption('14:00');
    await page.getByLabel('終了時刻').selectOption('15:00');
    await page.getByLabel('目的').fill(purpose);
    await page.getByRole('button', { name: '予約する' }).click();

    await expect(page.getByText('予約を登録しました')).toBeVisible();
    const row = page.getByRole('row', { name: purpose });     // 一覧の、目的を含む行
    await expect(row).toBeVisible();
    await expect(row).toContainText(date);
    await expect(row).toContainText('会議室C');
    await expect(row).toContainText('14:00〜15:00');

    // 後処理: 作った予約をキャンセルする
    const row = page.getByRole('row', { name: date });
    await row.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.getByText('予約をキャンセルしました')).toBeVisible();
  });
});
