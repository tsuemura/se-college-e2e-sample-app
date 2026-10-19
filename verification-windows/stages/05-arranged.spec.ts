import { test, expect, type Page } from '@playwright/test';

const runId = Date.now();                                  // この実行だけの目印。テストが作るデータに付ける

// スライド 85 の uniqueDate はスライドに無かったので、スライド 54 の 2 行から自分で作った
function uniqueDate() {
  const days = 1 + (Date.now() % 365);                                                       // 1〜365 のどれか。実行するたびに変わる
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);   // 例: '2027-03-15'
  return date;
}

async function loginAsTanaka(page: Page) {
  await page.request.post('/login', { form: { userId: 'tanaka', password: 'pass1234' } });   // フォームと同じ送信先
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
}

// 前提の予約を作る（Arrange）。手順に名前を付けて、テスト本体から出す（スライド 85。API に置き換えたので今は使っていない）
async function createReservation(page: Page, r: { roomId: string; date: string; startTime: string; endTime: string; purpose: string }) {
  await page.getByRole('link', { name: '新規予約' }).click();
  await page.getByLabel('会議室').selectOption(r.roomId);
  await page.getByLabel('日付').fill(r.date);
  await page.getByLabel('開始時刻').selectOption(r.startTime);
  await page.getByLabel('終了時刻').selectOption(r.endTime);
  await page.getByLabel('目的').fill(r.purpose);
  await page.getByRole('button', { name: '予約する' }).click();
  await expect(page.getByText('予約を登録しました')).toBeVisible();
}

test.describe('会議室の予約', () => {
  test.beforeEach(async ({ page }) => { await loginAsTanaka(page); });

  test.afterEach(async ({ page }) => {                       // 後処理: この実行が作った予約を消す
    const reservations = await (await page.request.get('/api/reservations')).json();
    for (const r of reservations) {
      if (String(r.purpose).includes(String(runId))) await page.request.delete(`/api/reservations/${r.id}`);
    }
  });

  test('会議室を予約すると一覧に表示される', async ({ page }) => {
    const date = uniqueDate();
    const purpose = `勉強会 win-ci ${runId}`;                   // 目的。afterEach で消せるように runId を付けた
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
  });

  test('予約済みの時間帯には予約できない', async ({ page }) => {
    const date = uniqueDate();
    // 前処理: 2 本目のテストの「予約済みの時間帯」を API で作る（目的に runId を付けておく）
    await page.request.post('/api/reservations', { data: { roomId: 'A', date, startTime: '10:00', endTime: '11:00', purpose: `定例 win-ci ${runId}` } });
    // ここから本体: 重なる予約を試す（操作）→「指定した時間帯はすでに予約されています」（期待結果）
    await page.getByRole('link', { name: '新規予約' }).click();
    await page.getByLabel('会議室').selectOption('A');
    await page.getByLabel('日付').fill(date);
    await page.getByLabel('開始時刻').selectOption('10:30');
    await page.getByLabel('終了時刻').selectOption('11:30');
    await page.getByLabel('目的').fill(`重複する予約 win-ci ${runId}`);
    await page.getByRole('button', { name: '予約する' }).click();
    await expect(page.getByText('指定した時間帯はすでに予約されています')).toBeVisible();
    await expect(page.getByRole('heading', { name: '新規予約' })).toBeVisible();
  });

  test('他の人の予約にはキャンセルボタンが出ない', async ({ page }) => {
    // 前提: 初期データの鈴木さんの予約（採用面接）
    const row = page.getByRole('row', { name: '採用面接' });
    await expect(row).toContainText('鈴木 花子');
    await expect(row.getByRole('button', { name: 'キャンセル' })).toHaveCount(0);
  });
});

// 前処理なし（ログインしない）ので describe の外に書いた
test('間違ったパスワードではログインできない', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('ユーザーID').fill('tanaka');
  await page.getByLabel('パスワード').fill('wrong-password');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByText('ユーザーIDまたはパスワードが正しくありません')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
});
