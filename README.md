# 会議室予約システム（実践E2E自動テスト 演習用サンプルアプリケーション）

講座「実践E2E自動テスト」で使う、演習用の Web アプリケーションです。社内の会議室を予約する小さなアプリで、**自動テストはまだありません**。講座の中で、このアプリに Playwright を導入して E2E テストを書いていきます。

- [仕様書](docs/spec.md)
- [ユーザーマニュアル](docs/manual.md)
- [講座用の配布物（設定ファイルの雛形、完成版のテスト）](course/README.md)

## 必要なもの

- Windows 10 / 11（macOS / Linux でも動作します）
- [Node.js](https://nodejs.org/) LTS 版（20 以上）
- [Git for Windows](https://git-scm.com/download/win)（ZIP でダウンロードする場合は不要）
- エディタ（[Visual Studio Code](https://code.visualstudio.com/) を推奨）

コマンドは PowerShell またはコマンドプロンプトで実行します。WSL2 は使いません。

## セットアップ

### 1. ダウンロード

ZIP を使う場合は、GitHub の「Code」→「Download ZIP」（または配布された ZIP）を保存し、右クリック →「すべて展開」で展開して、`package.json` があるフォルダにターミナルで移動します。

```powershell
cd $HOME\Downloads\se-college-e2e-sample-app-main
```

Git を使う場合:

```powershell
git clone https://github.com/tsuemura/se-college-e2e-sample-app.git
cd se-college-e2e-sample-app
```

### 2. インストール

```powershell
npm install
```

このアプリは Node.js の標準モジュールだけで動くので、すぐに終わります。

### 3. 起動

```powershell
npm start
```

ブラウザで <http://localhost:3000> を開くと、ログイン画面が表示されます。
ログインに使うアカウントは画面下部に表示されています（`tanaka` / `pass1234` など）。
終了するときは `Ctrl + C` を押します。

## 自動テストを追加する（講座で行う内容）

このアプリには自動テストがありません。講座では次の手順で Playwright を導入します。詳しくは [course/README.md](course/README.md) を参照してください。

```powershell
npm install -D @playwright/test
npx playwright install chromium
Copy-Item course\playwright.config.ts .     # cmd: copy course\playwright.config.ts .  / Mac: cp course/playwright.config.ts .
mkdir tests
```

`tests/` にテストを書いて `npx playwright test` で実行します。完成版は `course/solutions/` にあります。

## フォルダ構成

```
app/          サンプルアプリケーション本体（Node.js 標準モジュールのみで動作）
docs/         仕様書・ユーザーマニュアル
course/       講座用の配布物（Playwright の設定ファイルの雛形、完成版のテスト、講師用ツール）
```

## バージョンについて

| ブランチ | 内容 |
| --- | --- |
| `main` | 最初のバージョン（v1） |
| `v2` | 仕様追加版。講義の後半で使います |
| `v2-fixed` | v2 の不具合を修正し、新機能のテストを追加した答え |

`v2` に切り替えるには次のコマンドを実行します（`tests` フォルダに作ったテストや、追加した Playwright はそのまま残ります）。

```powershell
git checkout v2
```

ZIP の場合は、先に今の `app` フォルダを `app-v1` という名前でコピーしておき（あとで差分を見るため）、`v2` ブランチの ZIP をダウンロードして `app` フォルダと `docs` フォルダを上書きコピーしてください。差分はコマンドプロンプトの `fc app-v1\reservation.js app\reservation.js` で確認できます。

## トラブルシューティング

### PowerShell で `npm` や `npx` を実行するとエラーになる

「このシステムではスクリプトの実行が無効になっているため…」と表示される場合は、PowerShell のスクリプト実行ポリシーが原因です（`npm --version` の時点で出ます）。次のいずれかで対処できます。

- コマンドプロンプトを使う
- PowerShell で次を実行してから再度試す

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```

### Node.js のインストールで管理者の確認（UAC）が出る／管理者権限がない

nodejs.org のインストーラーは管理者の確認が必要です。自分の PC なら「はい」を押してください。会社の PC などで管理者権限がない場合は、ユーザー権限だけでインストールできます。

```powershell
winget install --id OpenJS.NodeJS.LTS --scope user
```

### `node` や `npm` が「認識されていません」と出る

インストール前から開いていたターミナルには反映されません。ターミナルを閉じて開き直してください。

### ZIP を展開したのに `package.json` が見つからない

「すべて展開」では、同じ名前のフォルダが二重にできることがあります。`package.json` があるフォルダまで `cd` してください。

### ポート 3000 がすでに使われている

別のポートで起動できます。Playwright を入れたあとは `playwright.config.ts` の `baseURL` と `webServer.url` も合わせて変更してください。

```powershell
# PowerShell
$env:PORT = "4000"; npm start

# コマンドプロンプト
set PORT=4000 && npm start

# macOS / Linux
PORT=4000 npm start
```

### ブラウザのインストールに失敗した（Playwright 導入時）

ネットワークの都合で `npx playwright install chromium` に失敗した場合は、ネットワークを確認して再実行してください。社内プロキシがある場合は `HTTPS_PROXY` の設定が必要なことがあります。

### 赤い文字で `npm notice` や `Warning` が出る

通知です。失敗ではありません。`added N packages` や `N passed` が出ていれば成功しています。

### テスト結果が `✓` ではなく `ok` と表示される

Windows ではそれが正常です（パスも `\` 区切りになります）。`passed` / `failed` の件数を見てください。

### `npx playwright show-report` でブラウザが開かない

既定のブラウザが設定されていないと自動で開きません。表示された URL（http://localhost:9323）をブラウザで開いてください。終了はそのターミナルで `Ctrl + C` です。

### 状態をリセットしたい

画面下部の「データを初期化」ボタンを押すか、アプリケーションを再起動してください。
