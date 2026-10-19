import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// 最終形のテストを動画つきで実行するための設定（検証用。講義スライドには登場しない）。
const e2eDir = process.env.E2E_DIR ?? process.cwd();
export default defineConfig({
  testDir: path.join(e2eDir, 'tests'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.resolve(process.env.RECORD_OUTPUT_DIR ?? path.join(e2eDir, 'videos')),
  reporter: [['list']],
  use: {
    baseURL: process.env.DEMO_URL ?? 'https://se-college-demo.takuyasuemura.workers.dev',
    trace: 'retain-on-failure',
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
