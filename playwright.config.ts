import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright の設定ファイル
 * https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストコードを置くフォルダ
  testDir: './tests',

  // サンプルアプリはメモリ上にデータを持つため、テストは 1 つずつ順番に実行する
  fullyParallel: false,
  workers: 1,
  retries: 0,

  // 結果の表示方法: ターミナルに一覧表示 + HTML レポート（自動では開かない）
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // page.goto('/login') のように相対パスで指定できるようにする
    baseURL: 'http://localhost:3000',
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

  // テスト実行前にサンプルアプリを自動で起動する（すでに起動していればそれを使う）
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
