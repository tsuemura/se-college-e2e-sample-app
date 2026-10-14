# デモ環境のデプロイ（Cloudflare Containers）

講座で全員が使うデモ環境を Cloudflare にデプロイするための設定です。アプリ本体（`app/`）には手を入れず、`Dockerfile` でそのまま動かします。

- Worker（`worker.js`）がすべてのリクエストを 1 つのコンテナに転送する
- アプリはメモリ上にデータを持つので、コンテナは常に 1 つ。**デプロイや停止のたびにデータは消える**（講座の設計上、問題ない）
- 6 時間アクセスがないと停止する。次のアクセスで数秒かけて起動する

## 準備（最初の 1 回）

Docker Desktop を起動しておく（イメージのビルドに使う）。

```
cd deploy/cloudflare
npm install
npx wrangler login      # ブラウザで Cloudflare にログイン
```

## デプロイ

```
cd deploy/cloudflare
npx wrangler deploy
```

URL は `https://se-college-demo.<アカウントのサブドメイン>.workers.dev`。初回は数分かかる。

コマンドが終わっても、すでに動いているコンテナが新しい版に入れ替わるまで 5 分ほどかかる。画面を開いて確認する。イメージの転送でネットワークのエラー（`tls: bad record MAC` など）が出たら、同じコマンドをもう一度。

## 講義中の切り替え（休憩中に v2、修正後に v2-fixed）

```
git checkout v2 && (cd deploy/cloudflare && npx wrangler deploy)
git checkout v2-fixed && (cd deploy/cloudflare && npx wrangler deploy)
```

切り替え（入れ替わりまで 5 分ほど）のあと、受講者のブラウザは再読み込みすれば新しい画面になる。ログインし直しが必要（セッションも消える）。

## 確認・ログ

```
npx wrangler tail                      # リクエストのログを流す
curl -I https://<URL>/login            # 200 が返れば起動している
```

## 講義の前日・当日

- 前日: `main` をデプロイし直してデータを空にしておく
- 当日 開始前: URL を一度ブラウザで開いて起こしておく
