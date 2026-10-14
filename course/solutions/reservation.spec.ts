import { test, expect, type Page } from '@playwright/test';

// テストごとに新しいアカウントを作る（＝自分専用のワークスペースで始める）。
// 画面のフォームと同じ送信先に直接 POST するので、サインアップ画面は経由しない。
// page.request はブラウザと Cookie を共有するので、送った直後からログイン済みになる。
async function signUp(page: Page) {
  const email = `taro-${Date.now()}@example.com`; // 毎回違うメールアドレスにする
  await page.request.post('/signup', {
    form: { name: 'テスト 太郎', email, password: 'pass1234' },
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
}

test.describe('会議室の予約', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test('会議室を予約すると一覧に表示される', async ({ page }) => {
    const purpose = `勉強会 ${Date.now()}`; // 自分のテストが作ったデータだと分かる目印

    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('C');
    await page.getByLabel('日付').fill('2030-04-02');
    await page.getByLabel('開始時刻').selectOption('14:00');
    await page.getByLabel('終了時刻').selectOption('15:00');
    await page.getByLabel('目的').fill(purpose);
    await page.getByRole('button', { name: '予約する' }).click();

    await expect(page.getByText('予約を登録しました')).toBeVisible();
    const row = page.getByRole('row', { name: purpose });
    await expect(row).toBeVisible();
    await expect(row).toContainText('2030-04-02');
    await expect(row).toContainText('14:00〜15:00');
    await expect(row).toContainText('会議室C');
    await expect(row).toContainText('テスト 太郎');
  });

  test('予約済みの時間帯には予約できない', async ({ page }) => {
    // サインアップ直後のサンプル予約: 会議室A 2030-04-01 10:00〜11:00 に「プロジェクト定例」がある
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

  test('自分の予約をキャンセルできる', async ({ page }) => {
    const purpose = `キャンセルする予約 ${Date.now()}`;
    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('B');
    await page.getByLabel('日付').fill('2030-04-03');
    await page.getByLabel('開始時刻').selectOption('09:00');
    await page.getByLabel('終了時刻').selectOption('10:00');
    await page.getByLabel('目的').fill(purpose);
    await page.getByRole('button', { name: '予約する' }).click();

    const row = page.getByRole('row', { name: purpose });
    await row.getByRole('button', { name: 'キャンセル' }).click();

    await expect(page.getByText('予約をキャンセルしました')).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test('他の人の予約にはキャンセルボタンが表示されない', async ({ page }) => {
    const sampleRow = page.getByRole('row', { name: 'プロジェクト定例' }); // 同僚（佐藤 一郎）のサンプル予約
    await expect(sampleRow).toBeVisible();
    await expect(sampleRow.getByRole('button', { name: 'キャンセル' })).toHaveCount(0);
  });
});
