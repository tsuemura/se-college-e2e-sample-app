import { test, expect } from '@playwright/test';

// サインアップ画面そのもののテスト。
// 他のテストでは前提条件として API で直接登録するが、画面の動きはここで 1 回だけ確認する。
test.describe('新規登録', () => {
  test('登録すると、自分のワークスペースの予約一覧が表示される', async ({ page }) => {
    const email = `taro-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.getByLabel('名前').fill('テスト 太郎');
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel('パスワード').fill('pass1234');
    await page.getByRole('button', { name: '登録する' }).click();

    await expect(page.getByText('登録が完了しました')).toBeVisible();
    await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
    await expect(page.getByText('ログイン中: テスト 太郎')).toBeVisible();
    // 新しいワークスペースにはサンプルの予約が入っている
    await expect(page.getByRole('row', { name: 'プロジェクト定例' })).toBeVisible();
  });

  test('登録済みのメールアドレスでは登録できない', async ({ page, request }) => {
    const email = `taro-${Date.now()}@example.com`;
    // request フィクスチャはブラウザと Cookie を共有しないので、登録してもブラウザ側はログインされない
    await request.post('/signup', { form: { name: '先に登録した人', email, password: 'pass1234' } });

    await page.goto('/signup');
    await page.getByLabel('名前').fill('テスト 太郎');
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel('パスワード').fill('pass1234');
    await page.getByRole('button', { name: '登録する' }).click();

    await expect(page.getByText('このメールアドレスはすでに登録されています')).toBeVisible();
    await expect(page.getByRole('heading', { name: '新規登録' })).toBeVisible();
  });
});
