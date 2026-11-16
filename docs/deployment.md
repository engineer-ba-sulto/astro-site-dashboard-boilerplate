# デプロイと環境変数

デプロイの順番と画面の項目名は [setup.md](setup.md) です。ここは環境ごとの値の対応です。

本番の秘密は `wrangler secret put` で入れます。`wrangler.jsonc` の `vars` に秘密を書かないでください。`.env` と `.dev.vars` は git に含まれません。

## 環境変数

| 変数                            | 置き場所                   | 用途                                                | 未設定のとき                                    |
| ------------------------------- | -------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `PUBLIC_SITE_URL`               | web / dashboard            | サイトの正 URL。OGP、サイトマップ、canonical        | `http://localhost:4321`                         |
| `PUBLIC_API_BASE_URL`           | web                        | ブラウザが `POST /api/contact` する api のオリジン  | `http://localhost:8787`                         |
| `PUBLIC_GA4_MEASUREMENT_ID`     | web                        | GA4                                                 | タグを出さない                                  |
| `PUBLIC_CF_WEB_ANALYTICS_TOKEN` | web                        | Cloudflare Web Analytics                            | タグを出さない                                  |
| `PUBLIC_TURNSTILE_SITE_KEY`     | web                        | Turnstile ウィジェット                              | ウィジェットを出さない                          |
| `API_BASE_URL`                  | dashboard                  | api の URL。サーバー側だけ                          | `http://localhost:8787`（本番では必ず本番 URL） |
| `TURNSTILE_SECRET_KEY`          | api の secret              | Turnstile 検証                                      | 検証をスキップ                                  |
| `IP_HASH_SECRET`                | api の secret              | IP の HMAC。生 IP は保存しない                      | 受付は 500。本番では必須                        |
| `RESEND_API_KEY`                | api の secret              | 通知メール                                          | 保存のみ                                        |
| `CONTACT_NOTIFY_TO`             | api                        | 通知の宛先                                          | キーがあっても送信しない                        |
| `CONTACT_FROM`                  | api                        | 通知の送信元。本番は認証済みドメイン                | 同上                                            |
| `CF_ACCESS_CLIENT_ID`           | dashboard と api の secret | 管理 API のサービストークン                         | 管理 API は 401                                 |
| `CF_ACCESS_CLIENT_SECRET`       | dashboard と api の secret | 同上                                                | 同上                                            |
| `ACCESS_TEAM_DOMAIN`            | dashboard の secret        | Access JWT の発行者。例 `team.cloudflareaccess.com` | 本番ビルドは 403。開発サーバーは検証を省略      |
| `ACCESS_AUD`                    | dashboard の secret        | Access アプリケーションの AUD                       | 同上                                            |
| `DEMO_MODE`                     | api                        | `true` のあいだ保存も通知もしない                   | 通常動作                                        |
| `WEB_ORIGIN`                    | api                        | CORS で許可するサイトのオリジン。カンマ区切り可     | ローカルの 4321 だけ許可                        |
| `DASHBOARD_BASE_URL`            | api                        | 通知メールに入れる詳細 URL の起点                   | `http://localhost:4322`                         |

`PUBLIC_API_BASE_URL`、`WEB_ORIGIN`、`DASHBOARD_BASE_URL` は、ブラウザから api へ直接送ることと、通知メールに管理画面の URL を入れるために必要です。

## ローカル

`.dev.vars.example` を `.dev.vars` にコピーし、`bun run db:migrate:local` のあと `bun run dev` です。D1 のファイルは `apps/api/.wrangler` にでき、git には入りません。

## 本番

1. D1 を作り、`database_id` を `apps/api/wrangler.jsonc` に書く
2. `bun run db:migrate:remote`
3. 上の表の本番 URL を `vars` と web のビルド環境変数に入れる
4. secret を入れる
5. `apps/api`、`apps/web`、`apps/dashboard` の順に `wrangler deploy`（web と dashboard は `bun run deploy`）
6. Access で dashboard のホストを保護する
7. 自分のアドレスでフォームを1件送り、管理画面で見えること、通知が届くこと（Resend を使う場合）を確認する

デモ用に保存させたくない環境では、api の `DEMO_MODE` を `true` にします。本番の受付用 Worker とは別のデプロイにしてください。

CI はビルドまでです。デプロイは CI から行いません。
