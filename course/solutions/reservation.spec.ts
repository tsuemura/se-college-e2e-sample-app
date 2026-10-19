import { test, expect, type Page } from '@playwright/test';

// この実行だけの目印。テストが作るデータに付けて、自分が作ったものだけを片付ける。
// テストは複数の worker（プロセス）で並列に動き、ファイルは worker ごとに読み込まれる。
// 時刻だけだと同じミリ秒に読み込んだ worker 同士で同じ値になり、他のテストの予約まで消してしまうので、プロセス番号を足す
const runId = `${Date.now()}-${process.pid}`;

// 田中さんとしてログインする（事前条件）。
// 画面を通さず、ログインのフォームと同じ送信先に直接 POST する。
// page.request はブラウザと Cookie を共有するので、送った直後からログイン済みになる
async function loginAsTanaka(page: Page) {
  await page.request.post('/login', { form: { userId: 'tanaka', password: 'pass1234' } });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
}

// テストが使う日付。今日から 1〜365 日後のどこかで、実行するたびに変わる（他の予約とぶつからないようにする）
function uniqueDate(): string {
  const days = 1 + (Date.now() % 365);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 予約を API で登録する（事前条件を画面を通さずに作る）
async function createReservation(page: Page, data: { roomId: string; date: string; startTime: string; endTime: string; purpose: string }) {
  const response = await page.request.post('/api/reservations', { data });
  expect(response.status()).toBe(201);
  return response.json();
}

test.describe('会議室の予約', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTanaka(page);
  });

  // 事後条件: このテストが作った予約を API で消す（失敗したときも実行される）
  test.afterEach(async ({ page }) => {
    const reservations = await (await page.request.get('/api/reservations')).json();
    for (const r of reservations) {
      if (String(r.purpose).includes(runId)) {
        await page.request.delete(`/api/reservations/${r.id}`);
      }
    }
  });

  test('会議室を予約すると一覧に表示される', async ({ page }) => {
    const date = uniqueDate();
    const purpose = `勉強会 ${runId}`;

    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('C');
    await page.getByLabel('日付').fill(date);
    await page.getByLabel('開始時刻').selectOption('14:00');
    await page.getByLabel('終了時刻').selectOption('15:00');
    await page.getByLabel('目的').fill(purpose);
    await page.getByRole('button', { name: '予約する' }).click();

    await expect(page.getByText('予約を登録しました')).toBeVisible();
    const row = page.getByRole('row', { name: purpose });
    await expect(row).toBeVisible();
    await expect(row).toContainText(date);
    await expect(row).toContainText('14:00〜15:00');
    await expect(row).toContainText('会議室C');
    await expect(row).toContainText('田中 太郎');
  });

  test('予約済みの時間帯には予約できない', async ({ page }) => {
    const date = uniqueDate();
    // 事前条件: 会議室A のこの日 10:00〜11:00 に予約がある
    await createReservation(page, { roomId: 'A', date, startTime: '10:00', endTime: '11:00', purpose: `定例 ${runId}` });

    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('A');
    await page.getByLabel('日付').fill(date);
    await page.getByLabel('開始時刻').selectOption('10:30');
    await page.getByLabel('終了時刻').selectOption('11:30');
    await page.getByLabel('目的').fill(`重複する予約 ${runId}`);
    await page.getByRole('button', { name: '予約する' }).click();

    await expect(page.getByText('指定した時間帯はすでに予約されています')).toBeVisible();
    await expect(page.getByRole('heading', { name: '新規予約' })).toBeVisible();
  });

  test('自分の予約をキャンセルできる', async ({ page }) => {
    const date = uniqueDate();
    const purpose = `キャンセルする予約 ${runId}`;
    await createReservation(page, { roomId: 'B', date, startTime: '09:00', endTime: '10:00', purpose });
    await page.reload();

    const row = page.getByRole('row', { name: purpose });
    await row.getByRole('button', { name: 'キャンセル' }).click();

    await expect(page.getByText('予約をキャンセルしました')).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test('他の人の予約にはキャンセルボタンが表示されない', async ({ page }) => {
    const row = page.getByRole('row', { name: '採用面接' }); // 鈴木さんの予約（初期データ）
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'キャンセル' })).toHaveCount(0);
  });
});
