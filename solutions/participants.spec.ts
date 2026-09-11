import { test, expect, type Page } from '@playwright/test';

// v2 で追加された「参加人数」に関するテスト

async function loginAsTanaka(page: Page) {
  await page.goto('/login');
  await page.getByLabel('ユーザーID').fill('tanaka');
  await page.getByLabel('パスワード').fill('pass1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
}

// 新規予約フォームを埋める（参加人数だけをテストごとに変える）
async function fillReservationForm(page: Page, participants: string) {
  await page.getByRole('link', { name: '新規予約' }).first().click();
  await page.getByLabel('会議室').selectOption('A'); // 定員 6 名
  await page.getByLabel('日付').fill('2030-04-02');
  await page.getByLabel('開始時刻').selectOption('10:00');
  await page.getByLabel('終了時刻').selectOption('11:00');
  await page.getByLabel('参加人数').fill(participants);
  await page.getByLabel('目的').fill('チーム会議');
  await page.getByRole('button', { name: '予約する' }).click();
}

test.describe('参加人数', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/reset');
    await loginAsTanaka(page);
  });

  test('参加人数が一覧に表示される', async ({ page }) => {
    await fillReservationForm(page, '4');

    await expect(page.getByText('予約を登録しました')).toBeVisible();
    await expect(page.getByRole('row', { name: 'チーム会議' })).toContainText('4名');
  });

  test('定員ちょうどの人数なら予約できる', async ({ page }) => {
    await fillReservationForm(page, '6');

    await expect(page.getByText('予約を登録しました')).toBeVisible();
  });

  test('定員を超える人数では予約できない', async ({ page }) => {
    await fillReservationForm(page, '7');

    await expect(page.getByText('参加人数が会議室の定員（6名）を超えています')).toBeVisible();
    await expect(page.getByRole('heading', { name: '新規予約' })).toBeVisible();
  });

  test('初期データの参加人数が一覧に表示される', async ({ page }) => {
    await expect(page.getByRole('row', { name: 'プロジェクト定例' })).toContainText('5名');
    await expect(page.getByRole('row', { name: '採用面接' })).toContainText('3名');
  });
});
