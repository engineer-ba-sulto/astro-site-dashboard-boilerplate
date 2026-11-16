# セットアップ

Cloudflare アカウントがある前提で、ローカル起動から本番の受付までを進めます。値の意味の一覧は [deployment.md](deployment.md) です。

## 1. ローカル

```bash
bun install
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
```

`apps/api/.dev.vars` の `IP_HASH_SECRET` を、推測しにくい長い文字列に変えます。ローカルの `CF_ACCESS_CLIENT_ID` と `CF_ACCESS_CLIENT_SECRET` は、api と dashboard で同じ値にしてください。例のファイルは最初から揃っています。

```bash
bun run db:migrate:local
bun run db:seed
bun run dev
```

`db:seed` は `@example.com` などのダミーを入れ直します。実在の顧客データは入りません。

パッケージのインストール、ワークスペース、テストは Bun です。Astro と wrangler の公開 CLI は shebang が Node で、`bun --bun` で Bun ランタイムに強制するとローカルの workerd との接続が失敗します（開発サーバーが 503 になる、または Vite プラグインが ECONNREFUSED になる）。`bun run` はこれらの CLI をそのまま起動します。

ブラウザで http://localhost:4321/contact/ から送信し、http://localhost:4322/contacts/ に行が増えることを確認します。

## 2. D1 を作る

```bash
cd apps/api
bunx wrangler login
bunx wrangler d1 create astro-site-dashboard-db
```

表示された `database_id` を `apps/api/wrangler.jsonc` の `d1_databases[0].database_id` に書き、仮の `00000000-0000-0000-0000-000000000000` を置き換えます。

```bash
bun run db:migrate:remote
```

これはルートで実行します。中身は `wrangler d1 migrations apply astro-site-dashboard-db --remote` です。

ダッシュボードから作る場合は、Cloudflare の **Workers & Pages → D1 → Create** です。データベース名は `astro-site-dashboard-db` にします。

## 3. Worker をデプロイする

先に api、次に web、最後に dashboard です。dashboard の `API_BASE_URL` には、デプロイ後の api の URL を入れます。

```bash
cd apps/api && bunx wrangler deploy
cd apps/web && bun run deploy
cd apps/dashboard && bun run deploy
```

`apps/dashboard/wrangler.jsonc` の `API_BASE_URL` と `PUBLIC_SITE_URL`、`apps/api/wrangler.jsonc` の `WEB_ORIGIN` と `DASHBOARD_BASE_URL` を、本番の URL に変えてからデプロイします。web の公開 URL はビルド時に `PUBLIC_SITE_URL` として渡します。

```bash
PUBLIC_SITE_URL=https://example.com PUBLIC_API_BASE_URL=https://api.example.com bun run deploy
```

`PUBLIC_API_BASE_URL` は、ブラウザがフォームを POST する api のオリジンです。

## 4. シークレット

api で必須なのは `IP_HASH_SECRET` です。次は、使うものだけ入れます。

```bash
cd apps/api
bunx wrangler secret put IP_HASH_SECRET
bunx wrangler secret put TURNSTILE_SECRET_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put CONTACT_NOTIFY_TO
bunx wrangler secret put CONTACT_FROM
bunx wrangler secret put CF_ACCESS_CLIENT_ID
bunx wrangler secret put CF_ACCESS_CLIENT_SECRET
```

dashboard では、api と同じサービストークンと、Access の検証値を入れます。

```bash
cd apps/dashboard
bunx wrangler secret put CF_ACCESS_CLIENT_ID
bunx wrangler secret put CF_ACCESS_CLIENT_SECRET
bunx wrangler secret put ACCESS_TEAM_DOMAIN
bunx wrangler secret put ACCESS_AUD
```

`wrangler secret put` は値をチャットやシェル履歴に残さないよう、プロンプトへ貼り付けてください。

## 5. Cloudflare Access

管理画面のドメイン全体を Access で保護します。一般の閲覧者は入れません。

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) を開く
2. **Access → Applications → Add an application → Self-hosted**
3. Application domain に dashboard のホスト名を入れる
4. **Policies** で Action を **Allow** にし、Include を **Emails** にして管理者のメールアドレスだけを入れる
5. 保存後、アプリケーションの概要にある **Application Audience (AUD) Tag** を `ACCESS_AUD` にする
6. チームドメイン（`<team>.cloudflareaccess.com`）を `ACCESS_TEAM_DOMAIN` にする。スキームは付けません

サービストークンは **Access → Service Auth → Service Tokens → Create Service Token** です。表示された Client ID と Client Secret を、api と dashboard の両方のシークレットに入れます。このトークンはブラウザへ出しません。

Access の前に Basic 認証を重ねる構成も取れますが、このボイラープレートの既定は Access だけです。

## 6. Turnstile

1. Cloudflare ダッシュボードの **Turnstile → Add widget**
2. ホスト名に公開サイトのドメインを入れる
3. Site Key を web の `PUBLIC_TURNSTILE_SITE_KEY` にする
4. Secret Key を api の `TURNSTILE_SECRET_KEY` にする

どちらかが空なら、その側の検証は動きません。ローカルでは両方空のままで送信できます。本番でボット対策を有効にするときは、必ず両方入れます。

## 7. Resend

管理者への着信通知だけです。送信者への自動返信はありません。

1. [Resend](https://resend.com) で **API Keys** を作り、`RESEND_API_KEY` にする
2. **Domains → Add Domain** で送信元ドメインを追加する
3. 表示された DNS レコードを入れる。SPF は TXT（`v=spf1 include:amazonses.com` を含む Resend 指定の値）、DKIM は Resend が示す CNAME です
4. ステータスが Verified になってから、`CONTACT_FROM` をそのドメインのアドレス（例 `noreply@example.com`）にする
5. `CONTACT_NOTIFY_TO` に、通知を受け取る管理者のアドレスを入れる

認証前の `onboarding@resend.dev` は、Resend が宛先を自分のアドレスに限る開発用です。本番の送信元には使いません。

キーが空のときはメールを送らず、D1 への保存だけで受付は成功します。送信に失敗しても受付は成功のままで、失敗は Worker のログに残します。

## 8. アクセス解析

web だけです。dashboard と api には入れません。

- **GA4**: 管理 → データストリーム → ウェブの測定 ID（`G-` で始まる）を `PUBLIC_GA4_MEASUREMENT_ID` にする
- **Cloudflare Web Analytics**: ダッシュボードの **Analytics & logs → Web Analytics → Add a site** で出るトークンを `PUBLIC_CF_WEB_ANALYTICS_TOKEN` にする

空のときは、そのタグ自体を HTML に出しません。イベントに名前やメールアドレスは載せません。
