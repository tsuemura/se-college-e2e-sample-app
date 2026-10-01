// ドキュメント用のスクリーンショットを撮り直すスクリプト（講座の配布物。アプリの一部ではない）
//   npm install -D @playwright/test && npx playwright install chromium   （未導入なら）
//   node course/tools/screenshots.mjs
// サンプルアプリを一時的にポート 3999 で起動し、docs/images/ に PNG を保存します。
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve('docs/images');

const server = spawn(process.execPath, ['app/server.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/login`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function login(page, userId = 'tanaka') {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('ユーザーID').fill(userId);
  await page.getByLabel('パスワード').fill('pass1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
}

try {
  await waitForServer();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1000, height: 640 },
    deviceScaleFactor: 2,
    locale: 'ja-JP',
  });
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

  await page.request.post(`${BASE}/api/reset`);

  await page.goto(`${BASE}/login`);
  await shot('login');

  await page.getByLabel('ユーザーID').fill('tanaka');
  await page.getByLabel('パスワード').fill('wrong');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await shot('login-error');

  await login(page);
  await shot('list');

  await page.getByRole('link', { name: '新規予約' }).click();
  await shot('new');

  await page.getByLabel('会議室').selectOption('A');
  await page.getByLabel('日付').fill('2030-04-01');
  await page.getByLabel('開始時刻').selectOption('10:30');
  await page.getByLabel('終了時刻').selectOption('11:30');
  await page.getByLabel('目的').fill('重複する予約');
  await page.getByRole('button', { name: '予約する' }).click();
  await shot('new-error');

  await page.getByLabel('会議室').selectOption('C');
  await page.getByLabel('日付').fill('2030-04-02');
  await page.getByLabel('開始時刻').selectOption('14:00');
  await page.getByLabel('終了時刻').selectOption('15:00');
  await page.getByLabel('目的').fill('勉強会');
  await page.getByRole('button', { name: '予約する' }).click();
  await shot('list-created');

  await browser.close();
  console.log(`saved screenshots to ${OUT}`);
} finally {
  server.kill();
}
