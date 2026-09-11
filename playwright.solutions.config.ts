import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * 講義で紹介する完成版テストコード（solutions フォルダ）を実行するための設定。
 *   npm run test:solutions
 */
export default defineConfig({
  ...baseConfig,
  testDir: './solutions',
});
