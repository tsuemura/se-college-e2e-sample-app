# 講座用の配布物（アプリの一部ではありません）

このフォルダは講座「実践E2E自動テスト」で使う資料です。サンプルアプリ本体（`app/`）は、**まだ自動テストがない Web アプリケーション**という設定で、講師がデモ環境にデプロイして使います。受講者はアプリを手元で動かさず、デモ環境に対して Playwright でテストを書きます。

| パス | 内容 |
| --- | --- |
| `solutions/` | 講座で作るテストコードの完成版。時間が足りないときは `tests/` にコピーしてよい（GitHub で開いて「Copy raw file」） |
| `playwright.config.ts` | ローカルで動かしたアプリに対して実行するときの設定（CI もこれを使う。`webServer` でアプリを自動起動する） |
| `tools/` | 講師・CI 用のスクリプト（スクリーンショットの再生成、CI の検証） |

## 受講者の手順

テスト用のフォルダを作り、Playwright のひな形を作ります（どの OS でも同じ）。テストランナーとブラウザも一緒に入ります。

```
mkdir e2e
cd e2e
npm init -y playwright@latest -- --quiet --browser=chromium --no-examples
```

`playwright.config.ts` の `use` に次の 2 行を書きます（`baseURL` はコメントを外してデモ環境の URL に、`trace` は失敗時に記録を残す設定に）。

```ts
    baseURL: 'https://se-college-demo.takuyasuemura.workers.dev',
    trace: 'retain-on-failure',
```

あとは講座のとおり、`npx playwright codegen https://se-college-demo.takuyasuemura.workers.dev` で録画し、`tests/` に保存して `npx playwright test` で実行します。自分のアプリに入れるときも同じで、アプリのフォルダの中で `npm init playwright@latest` を実行し、`baseURL` を自分のアプリにするだけです。

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
