// 受講者に配る e2e-starter.zip を組み立てる（講師用）
//   node course/tools/build-starter.mjs            -> dist/e2e-starter.zip
// 中身: course/starter/ 一式 + 空の tests/ + course/solutions/ の完成版
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const dist = path.join(root, 'dist');
const work = path.join(dist, 'e2e-starter');

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
await cp(path.join(root, 'course/starter'), work, { recursive: true });
await mkdir(path.join(work, 'tests'), { recursive: true });
await writeFile(path.join(work, 'tests/.gitkeep'), '');
await cp(path.join(root, 'course/solutions'), path.join(work, 'solutions'), { recursive: true });
await writeFile(path.join(work, '.npmrc'), 'audit=false\nfund=false\nupdate-notifier=false\n');

const zip = path.join(dist, 'e2e-starter.zip');
await rm(zip, { force: true });
execFileSync('zip', ['-r', '-q', zip, 'e2e-starter'], { cwd: dist });
console.log(`wrote ${zip}`);
