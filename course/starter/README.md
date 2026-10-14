# 実践E2E自動テスト テストプロジェクト（スターター）

講座のデモ環境（会議室予約システム）に対して、Playwright でテストを書くためのフォルダです。アプリ本体は入っていません。

```
playwright.config.ts   設定。テスト対象の URL（baseURL）などが書いてある
tests/                 ここにテストコード（.spec.ts）を書く
solutions/             講座で作るテストの完成版。困ったときは tests/ にコピーしてよい
package.json
```

## 準備

このフォルダでターミナルを開いて、次の 2 行を実行します（どの OS でも同じ）。

```
npm install -D @playwright/test
npx playwright install chromium
```

## 実行

```
npx playwright codegen https://se-college-demo.takuyasuemura.workers.dev    # 録画
npx playwright test                                # 実行
npx playwright show-report                         # HTML レポート
```
