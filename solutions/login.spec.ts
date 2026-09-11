import { test, expect } from '@playwright/test';

test.describe('ログイン', () => {
  test('正しいユーザーIDとパスワードでログインできる', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('ユーザーID').fill('tanaka');
    await page.getByLabel('パスワード').fill('pass1234');
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page.getByRole('heading', { name: '予約一覧' })).toBeVisible();
    await expect(page.getByText('ログイン中: 田中 太郎')).toBeVisible();
  });

  test('パスワードが間違っているとログインできない', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('ユーザーID').fill('tanaka');
    await page.getByLabel('パスワード').fill('wrong-password');
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page.getByText('ユーザーIDまたはパスワードが正しくありません')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });

  test('ログアウトするとログイン画面に戻る', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('ユーザーID').fill('tanaka');
    await page.getByLabel('パスワード').fill('pass1234');
    await page.getByRole('button', { name: 'ログイン' }).click();

    await page.getByRole('button', { name: 'ログアウト' }).click();

    await expect(page.getByText('ログアウトしました')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });
});
