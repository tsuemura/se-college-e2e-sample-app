import { test, expect } from '@playwright/test';

// セットアップ確認用のテストです。
// 講義中に作成するテストは、このフォルダ（tests）に追加していきます。
test('ログイン画面が表示される', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/会議室予約システム/);
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
});
