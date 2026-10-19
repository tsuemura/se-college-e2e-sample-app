import { test, expect, type Page } from '@playwright/test';

// v2 で追加された「参加人数」に関するテスト

const runId = `${Date.now()}-${process.pid}`; // この実行だけの目印。時刻とプロセス番号（並列に動く worker ごとに違う値になる）

async function loginAsTanaka(page: Page) {
  await page.request.post('/login', { form: { userId: 'tanaka', password: 'pass1234' } });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
}

function uniqueDate(): string {
  const days = 1 + (Date.now() % 365);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 新規予約フォームを埋める（参加人数だけをテストごとに変える）
async function fillReservationForm(page: Page, participants: string, purpose: string) {
  await page.getByRole('link', { name: '新規予約' }).click();
  await page.getByLabel('会議室').selectOption('A'); // 定員 6 名
  await page.getByLabel('日付').fill(uniqueDate());
  await page.getByLabel('開始時刻').selectOption('10:00');
  await page.getByLabel('終了時刻').selectOption('11:00');
  await page.getByLabel('参加人数').fill(participants);
  await page.getByLabel('目的').fill(purpose);
  await page.getByRole('button', { name: '予約する' }).click();
}

test.describe('参加人数', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTanaka(page);
  });

  test.afterEach(async ({ page }) => {
    const reservations = await (await page.request.get('/api/reservations')).json();
    for (const r of reservations) {
      if (String(r.purpose).includes(runId)) {
        await page.request.delete(`/api/reservations/${r.id}`);
      }
    }
  });

  test('参加人数が一覧に表示される', async ({ page }) => {
    const purpose = `チーム会議 ${runId}`;
    await fillReservationForm(page, '4', purpose);

    await expect(page.getByText('予約を登録しました')).toBeVisible();
    await expect(page.getByRole('row', { name: purpose })).toContainText('4名');
  });

  test('定員ちょうどの人数なら予約できる', async ({ page }) => {
    await fillReservationForm(page, '6', `定員ちょうど ${runId}`);

    await expect(page.getByText('予約を登録しました')).toBeVisible();
  });

  test('定員を超える人数では予約できない', async ({ page }) => {
    await fillReservationForm(page, '7', `定員超過 ${runId}`);

    await expect(page.getByText('参加人数が会議室の定員（6名）を超えています')).toBeVisible();
    await expect(page.getByRole('heading', { name: '新規予約' })).toBeVisible();
  });

  test('初期データの参加人数が一覧に表示される', async ({ page }) => {
    await expect(page.getByRole('row', { name: 'プロジェクト定例' })).toContainText('5名');
    await expect(page.getByRole('row', { name: '採用面接' })).toContainText('3名');
  });
});
