# 講座用の配布物（アプリの一部ではありません）

このフォルダは講座「実践E2E自動テスト」で使う資料です。サンプルアプリ本体（`app/`）は、**まだ自動テストがない Web アプリケーション**という設定で、講師がデモ環境にデプロイして使います。受講者はアプリを手元で動かさず、デモ環境に対して Playwright でテストを書きます。

| パス | 内容 |
| --- | --- |
| `starter/` | 受講者に配るテストプロジェクトの雛形（設定ファイル、空の `tests/`）。`tools/build-starter.mjs` で `solutions/` と合わせて ZIP にする |
| `solutions/` | 講座で作るテストコードの完成版。時間が足りないときは `tests/` にコピーしてよい |
| `playwright.config.ts` | ローカルで動かしたアプリに対して実行するときの設定（CI もこれを使う。`webServer` でアプリを自動起動する） |
| `tools/` | 講師・CI 用のスクリプト（スターター ZIP の作成、スクリーンショットの再生成、CI の検証） |

## 受講者の手順（スターター ZIP）

```
npm install -D @playwright/test        # テストランナーを入れる（開発時だけ使うので -D）
npx playwright install chromium        # テストで使うブラウザを入れる
npx playwright codegen https://se-college-demo.takuyasuemura.workers.dev   # 録画
npx playwright test                    # 実行
```

## スターター ZIP を作る（講師）

```
node course/tools/build-starter.mjs    # dist/e2e-starter.zip
gh release upload starter dist/e2e-starter.zip --clobber
```

## ローカルのアプリに対して完成版を実行する（CI と同じ手順）

```
npm install
npm install -D @playwright/test
npx playwright install chromium
cp course/playwright.config.ts .       # Windows: copy course\playwright.config.ts .
mkdir tests
cp course/solutions/*.spec.ts tests/   # Windows: copy course\solutions\*.spec.ts tests\
npx playwright test                    # webServer の設定でアプリが自動で起動する
```
