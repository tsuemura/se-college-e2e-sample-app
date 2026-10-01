# 講座用の配布物（アプリの一部ではありません）

このフォルダは講座「実践E2E自動テスト」で使う資料です。サンプルアプリ本体（`app/`）は、**まだ自動テストがない Web アプリケーション**という設定です。講座の中で、受講者がこのアプリに Playwright を導入してテストを書いていきます。

| パス | 内容 |
| --- | --- |
| `playwright.config.ts` | 講座で使う Playwright の設定ファイル。Playwright を入れたあと、リポジトリ直下にコピーして使う |
| `solutions/` | 講座で作るテストコードの完成版。時間が足りないときは `tests/` にコピーしてよい |
| `tools/` | 講師・CI 用のスクリプト（スクリーンショットの再生成、CI の検証） |

## Playwright の導入手順（講座のセットアップと同じ）

```powershell
npm install -D @playwright/test        # テストランナーを入れる（開発時だけ使うので -D）
npx playwright install chromium        # テストで使うブラウザを入れる
Copy-Item course\playwright.config.ts .   # 設定ファイルをコピー（cmd: copy、Mac: cp course/playwright.config.ts .）
mkdir tests                            # テストコードを置くフォルダ
```

`tests/example.spec.ts` を作って（`course/solutions/example.spec.ts` の内容）、`npx playwright test` で `1 passed` になれば準備完了です。
