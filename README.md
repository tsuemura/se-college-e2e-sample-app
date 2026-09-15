# 実践E2E自動テスト 演習用サンプルアプリケーション

講座「実践E2E自動テスト」で使う、演習用の Web アプリケーション「会議室予約システム」です。
Playwright のテスト環境も含まれているので、`npm install` だけで演習を始められます。

- [仕様書](docs/spec.md)
- [ユーザーマニュアル](docs/manual.md)

## 必要なもの

- Windows 10 / 11（macOS / Linux でも動作します）
- [Node.js](https://nodejs.org/) LTS 版（20 以上）
- [Git for Windows](https://git-scm.com/download/win)（ZIP でダウンロードする場合は不要）
- エディタ（[Visual Studio Code](https://code.visualstudio.com/) を推奨）

コマンドは PowerShell またはコマンドプロンプトで実行します。WSL2 は使いません。

## セットアップ

### 1. ダウンロード

Git を使う場合:

```powershell
git clone https://github.com/tsuemura/se-college-e2e-sample-app.git
cd se-college-e2e-sample-app
```

ZIP を使う場合は、GitHub の「Code」→「Download ZIP」でダウンロードし、展開したフォルダにターミナルで移動します。

```powershell
cd $HOME\Downloads\se-college-e2e-sample-app-main
```

### 2. インストール

```powershell
npm install
```

Playwright と、テストで使うブラウザ（Chromium）も一緒にインストールされます。環境により数秒から十数分かかります。

### 3. 起動

```powershell
npm start
```

ブラウザで <http://localhost:3000> を開くと、ログイン画面が表示されます。
ログインに使うアカウントは画面下部に表示されています（`tanaka` / `pass1234` など）。
終了するときは `Ctrl + C` を押します。

## テストの実行

アプリケーションを起動したままでも、起動していなくても実行できます（起動していなければ自動で起動します）。

```powershell
# tests フォルダのテストを実行する
npx playwright test

# ブラウザの画面を表示しながら実行する
npx playwright test --headed

# UI モード（テストを選んで実行・操作を確認できる）
npx playwright test --ui

# 直前の実行結果を HTML レポートで確認する
npx playwright show-report

# ブラウザ操作を記録してテストコードを生成する（別のターミナルで npm start しておく）
npx playwright codegen http://localhost:3000
```

講義で紹介する完成版のテストコードは `solutions` フォルダにあり、次のコマンドで実行できます。

```powershell
npm run test:solutions
```

## フォルダ構成

```
app/          サンプルアプリケーション本体（Node.js 標準モジュールのみで動作）
docs/         仕様書・ユーザーマニュアル
tests/        演習で作成するテストコードを置くフォルダ
solutions/    完成版のテストコード
playwright.config.ts   Playwright の設定
```

## バージョンについて

| ブランチ | 内容 |
| --- | --- |
| `main` | 最初のバージョン（v1） |
| `v2` | 仕様追加版。講義の後半で使います |

`v2` に切り替えるには次のコマンドを実行します（`tests` フォルダに作ったテストはそのまま残ります）。

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

### 赤い文字で `npm notice` や `Warning` が出る

通知です。失敗ではありません。`added N packages` や `N passed` が出ていれば成功しています。

### テスト結果が `✓` ではなく `ok` と表示される

Windows ではそれが正常です（パスも `\` 区切りになります）。`passed` / `failed` の件数を見てください。

### `npx playwright show-report` でブラウザが開かない

既定のブラウザが設定されていないと自動で開きません。表示された URL（http://localhost:9323）をブラウザで開いてください。終了はそのターミナルで `Ctrl + C` です。

### ポート 3000 がすでに使われている

別のポートで起動できます。`playwright.config.ts` の `baseURL` と `webServer.url` も合わせて変更してください。

```powershell
# PowerShell
$env:PORT = "4000"; npm start

# コマンドプロンプト
set PORT=4000 && npm start

# macOS / Linux
PORT=4000 npm start
```

### ブラウザのインストールに失敗した

ネットワークの都合で `npm install` 中のブラウザダウンロードに失敗した場合は、後から次のコマンドでインストールできます。

```powershell
npx playwright install chromium
```

### 状態をリセットしたい

画面下部の「データを初期化」ボタンを押すか、アプリケーションを再起動してください。
