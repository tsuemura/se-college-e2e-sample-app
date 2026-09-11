// CI 用: Playwright の JSON レポートを読み、「失敗したテストの一覧」が期待どおりか確認する。
//
//   node scripts/check-expected-failures.mjs <results.json> <expected-failures.json>
//
// expected-failures.json には失敗するはずのテストタイトルを配列で書く。
// 仕様変更版（v2 ブランチ）では意図的にリグレッションを仕込んでいるため、
// 「そのテストだけが失敗し、他は成功する」ことを CI で検証するために使う。
import fs from 'node:fs';

const [resultsFile, expectedFile] = process.argv.slice(2);
if (!resultsFile || !expectedFile) {
  console.error('usage: node scripts/check-expected-failures.mjs <results.json> <expected-failures.json>');
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const expected = new Set(JSON.parse(fs.readFileSync(expectedFile, 'utf8')));

const failed = new Set();
const passed = new Set();
function walk(suite) {
  for (const spec of suite.specs ?? []) {
    (spec.ok ? passed : failed).add(spec.title);
  }
  for (const child of suite.suites ?? []) walk(child);
}
for (const suite of report.suites ?? []) walk(suite);

const unexpectedFailures = [...failed].filter((t) => !expected.has(t));
const unexpectedPasses = [...expected].filter((t) => !failed.has(t));

console.log(`passed: ${passed.size}, failed: ${failed.size}`);
for (const t of failed) console.log(`  failed: ${t}${expected.has(t) ? ' (expected)' : ''}`);

let ok = true;
if (unexpectedFailures.length > 0) {
  ok = false;
  console.error(`\n想定外の失敗があります:\n  - ${unexpectedFailures.join('\n  - ')}`);
}
if (unexpectedPasses.length > 0) {
  ok = false;
  console.error(`\n失敗するはずのテストが成功しています（または実行されていません）:\n  - ${unexpectedPasses.join('\n  - ')}`);
}
if (passed.size + failed.size === 0) {
  ok = false;
  console.error('\nテストが 1 件も実行されていません');
}
process.exit(ok ? 0 : 1);
