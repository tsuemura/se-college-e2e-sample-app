// verification-windows/shot.mjs
//
// 受講者が目で確認する場面を、ランナー上でヘッドレスに記録するための検証用の道具（講義スライドには登場しない）。
// 受講者が npm init playwright で入れた e2e/node_modules の @playwright/test を使う（E2E_DIR）。
//
//   node shot.mjs touch   <outDir> <prefix> <marker>        … ログイン・一覧・新規予約・重複エラーの画面（スライド 18）
//   node shot.mjs reserve <params.json> <outDir> <prefix>   … 録画中にブラウザで行う予約（スライド 35）を同じ画面操作で作る
//   node shot.mjs cancel  <params.json> <outDir> <prefix>   … 録画で作った予約を一覧からキャンセルする（スライド 38）
//   node shot.mjs report  <reportDir> <outDir> <name> <port> … npx playwright show-report の画面（一覧と、失敗の詳細）
//   node shot.mjs cleanup <marker> <year>                   … 目的に marker を含む、または日付が year 年の自分の予約を API で消す
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const e2eDir = process.env.E2E_DIR ?? process.cwd();
const base = process.env.DEMO_URL ?? 'https://se-college-demo.takuyasuemura.workers.dev';
const { chromium, request } = await import(pathToFileURL(path.join(e2eDir, 'node_modules/@playwright/test/index.mjs')).href);

const [, , mode, ...rest] = process.argv;
const out = (dir, name) => { fs.mkdirSync(dir, { recursive: true }); return path.join(dir, `${name}.png`); };

async function login(page) {
  await page.goto(`${base}/login`);
  await page.getByLabel('ユーザーID').fill('tanaka');
  await page.getByLabel('パスワード').fill('pass1234');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.getByRole('heading', { name: '予約一覧' }).waitFor();
}

async function fillReservation(page, p) {
  await page.getByRole('link', { name: '新規予約' }).click();
  await page.getByLabel('会議室').selectOption(p.room);
  await page.getByLabel('日付').fill(p.date);
  await page.getByLabel('開始時刻').selectOption(p.start);
  await page.getByLabel('終了時刻').selectOption(p.end);
  await page.getByLabel('目的').fill(p.purpose);
}

async function withPage(fn) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'ja-JP' });
  try { await fn(page); } finally { await browser.close(); }
}

async function apiContext() {
  const ctx = await request.newContext({ baseURL: base });
  const res = await ctx.post('/login', { form: { userId: 'tanaka', password: 'pass1234' } });
  if (![200, 302, 303].includes(res.status())) console.log(`login status ${res.status()}`);
  return ctx;
}

switch (mode) {
  case 'touch': {
    const [outDir, prefix, marker] = rest;
    await withPage(async (page) => {
      await page.goto(`${base}/login`);
      await page.screenshot({ path: out(outDir, `${prefix}-01-login`), fullPage: true });
      await login(page);
      await page.screenshot({ path: out(outDir, `${prefix}-02-list`), fullPage: true });
      const p = { room: 'A', date: '2031-01-15', start: '10:00', end: '11:00', purpose: `触ってみる ${marker}` };
      await fillReservation(page, p);
      await page.screenshot({ path: out(outDir, `${prefix}-03-new`), fullPage: true });
      await page.getByRole('button', { name: '予約する' }).click();
      await page.screenshot({ path: out(outDir, `${prefix}-04-registered`), fullPage: true });
      await fillReservation(page, { ...p, start: '10:30', end: '11:30', purpose: `重なる予約 ${marker}` });
      await page.getByRole('button', { name: '予約する' }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: out(outDir, `${prefix}-05-duplicate-error`), fullPage: true });
      console.log('duplicate error shown:', await page.getByText('すでに予約されています').count());
    });
    break;
  }
  case 'reserve': {
    const [paramsPath, outDir, prefix] = rest;
    const p = JSON.parse(fs.readFileSync(paramsPath, 'utf8'));
    await withPage(async (page) => {
      await login(page);
      await fillReservation(page, p);
      await page.getByRole('button', { name: '予約する' }).click();
      await page.waitForTimeout(500);
      const ok = await page.getByText('予約を登録しました').count();
      console.log(`reserve ${p.room} ${p.date} ${p.start}-${p.end} "${p.purpose}" → 登録メッセージ: ${ok}`);
      await page.screenshot({ path: out(outDir, `${prefix}-after-recording`), fullPage: true });
    });
    break;
  }
  case 'cancel': {
    const [paramsPath, outDir, prefix] = rest;
    const p = JSON.parse(fs.readFileSync(paramsPath, 'utf8'));
    await withPage(async (page) => {
      await login(page);
      const rows = page.getByRole('row').filter({ hasText: p.purpose }).filter({ hasText: p.date });
      const n = await rows.count();
      console.log(`一覧で「${p.purpose}」「${p.date}」の行: ${n}`);
      for (let i = 0; i < n; i++) {
        const row = page.getByRole('row').filter({ hasText: p.purpose }).filter({ hasText: p.date }).first();
        const btn = row.getByRole('button', { name: 'キャンセル' });
        if (await btn.count() === 0) { console.log('キャンセルボタンが無い行があった'); break; }
        await btn.click();
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: out(outDir, `${prefix}-after-cancel`), fullPage: true });
      console.log('残り:', await page.getByRole('row').filter({ hasText: p.purpose }).filter({ hasText: p.date }).count());
    });
    break;
  }
  case 'report': {
    const [reportDir, outDir, name, port] = rest;
    const proc = spawn(`npx playwright show-report "${reportDir}" --host 127.0.0.1 --port ${port}`, { shell: true, stdio: 'ignore', cwd: e2eDir });
    const url = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) { try { ready = (await fetch(url)).ok; } catch { await new Promise((r) => setTimeout(r, 200)); } }
    console.log(`show-report ready: ${ready}`);
    await withPage(async (page) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url); await page.waitForTimeout(800);
      await page.screenshot({ path: out(outDir, `${name}-01-overview`), fullPage: true });
      const first = page.locator('.test-file-test').first();
      if (await first.count()) {
        await first.locator('a, .test-file-title').first().click().catch(() => {});
        await page.waitForTimeout(800);
        await page.screenshot({ path: out(outDir, `${name}-02-test-detail`), fullPage: true });
        // スライド 48: Traces の画像をクリックしてトレースビューアーを開く
        const traceLink = page.locator('a[href*="trace="], a[href*="/trace/"]').first();
        console.log(`trace link: ${await traceLink.count()}`);
        if (await traceLink.count()) {
          await traceLink.click().catch((e) => console.log(`trace click failed: ${e.message}`));
          await page.waitForTimeout(4000);
          await page.screenshot({ path: out(outDir, `${name}-03-trace`) });
        }
      }
    });
    proc.kill();
    try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { shell: true }); } catch {}
    break;
  }
  case 'cleanup': {
    const [marker, year] = rest;
    const ctx = await apiContext();
    const list = await (await ctx.get('/api/reservations')).json();
    const all = Array.isArray(list) ? list : (list.reservations ?? []);
    const mine = all.filter((r) => (r.purpose ?? '').includes(marker) || String(r.date ?? '').startsWith(`${year}-`));
    console.log(`予約の総数 ${all.length} / 消す対象 ${mine.length}`);
    let deleted = 0;
    for (const r of mine) {
      const res = await ctx.delete(`/api/reservations/${r.id}`);
      console.log(`DELETE ${r.id} ${r.date} ${r.startTime ?? r.start ?? ''} "${r.purpose}" → ${res.status()}`);
      if (res.ok()) deleted++;
    }
    const after = await (await ctx.get('/api/reservations')).json();
    const afterAll = Array.isArray(after) ? after : (after.reservations ?? []);
    console.log(`消した: ${deleted} / 残りの総数 ${afterAll.length} / 残りの対象 ${afterAll.filter((r) => (r.purpose ?? '').includes(marker) || String(r.date ?? '').startsWith(`${year}-`)).length}`);
    await ctx.dispose();
    break;
  }
  default:
    console.error(`unknown mode: ${mode}`);
    process.exit(1);
}
