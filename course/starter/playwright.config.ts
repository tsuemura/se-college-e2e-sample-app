import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright の設定ファイル
 * https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストコードを置くフォルダ
  testDir: './tests',

  // テストは 1 つずつ順番に実行する
  fullyParallel: false,
  workers: 1,
  retries: 0,

  // 結果の表示方法: ターミナルに一覧表示 + HTML レポート（自動では開かない）
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // テスト対象（講座のデモ環境）。page.goto('/login') のように相対パスで指定できる
    baseURL: 'https://se-college-demo.takuyasuemura.workers.dev',
    // 失敗したテストのトレース（操作の記録）とスクリーンショットを残す
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
