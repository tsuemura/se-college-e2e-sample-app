import { test, expect, type Page } from '@playwright/test';

// 田中さんとしてログインする（複数のテストで使うので関数にまとめる）
async function loginAsTanaka(page: Page) {
  await page.goto('/login');
  await page.getByLabel('ユーザーID').fill('tanaka');
  await page.getByLabel('パスワード').fill('pass1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
}

test.describe('会議室の予約', () => {
  test.beforeEach(async ({ page }) => {
    // 前のテストの影響を受けないように、毎回データを初期状態に戻す
    await page.request.post('/api/reset');
    await loginAsTanaka(page);
  });

  test('会議室を予約すると一覧に表示される', async ({ page }) => {
    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('C');
    await page.getByLabel('日付').fill('2030-04-02');
    await page.getByLabel('開始時刻').selectOption('14:00');
    await page.getByLabel('終了時刻').selectOption('15:00');
    await page.getByLabel('目的').fill('勉強会');
    await page.getByRole('button', { name: '予約する' }).click();

    await expect(page.getByText('予約を登録しました')).toBeVisible();
    const row = page.getByRole('row', { name: '勉強会' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('2030-04-02');
    await expect(row).toContainText('14:00〜15:00');
    await expect(row).toContainText('会議室C');
    await expect(row).toContainText('田中 太郎');
  });

  test('予約済みの時間帯には予約できない', async ({ page }) => {
    // 初期データ: 会議室A 2030-04-01 10:00〜11:00 に「プロジェクト定例」がある
    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('A');
    await page.getByLabel('日付').fill('2030-04-01');
    await page.getByLabel('開始時刻').selectOption('10:30');
    await page.getByLabel('終了時刻').selectOption('11:30');
    await page.getByLabel('目的').fill('重複する予約');
    await page.getByRole('button', { name: '予約する' }).click();

    await expect(page.getByText('指定した時間帯はすでに予約されています')).toBeVisible();
    await expect(page.getByRole('heading', { name: '新規予約' })).toBeVisible();
  });

  test('終了時刻が開始時刻より前だと予約できない', async ({ page }) => {
    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('A');
    await page.getByLabel('日付').fill('2030-04-02');
    await page.getByLabel('開始時刻').selectOption('11:00');
    await page.getByLabel('終了時刻').selectOption('10:00');
    await page.getByLabel('目的').fill('時刻の指定ミス');
    await page.getByRole('button', { name: '予約する' }).click();

    await expect(page.getByText('終了時刻は開始時刻より後にしてください')).toBeVisible();
  });

  test('自分の予約をキャンセルできる', async ({ page }) => {
    const row = page.getByRole('row', { name: 'プロジェクト定例' });
    await row.getByRole('button', { name: 'キャンセル' }).click();

    await expect(page.getByText('予約をキャンセルしました')).toBeVisible();
    await expect(page.getByRole('row', { name: 'プロジェクト定例' })).toHaveCount(0);
  });

  test('他のユーザーの予約はキャンセルできない', async ({ page }) => {
    // 「採用面接」は鈴木さんの予約なので、キャンセルボタンが表示されない
    const row = page.getByRole('row', { name: '採用面接' });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'キャンセル' })).toHaveCount(0);
  });
});
