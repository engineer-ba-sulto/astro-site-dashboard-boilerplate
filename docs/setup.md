# セットアップ

Cloudflare アカウントがある前提で、ローカル起動から本番の受付までを進めます。値の意味の一覧は [deployment.md](deployment.md) です。

## 1. ローカル

リポジトリを clone したあと、ルートで次を実行します（README のクイックスタートと同じです）。

```bash
bun install
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
bun run db:migrate:local
```

`apps/api/.dev.vars` の `IP_HASH_SECRET` は、例のままでもローカルは動きます。共有 PC や長期運用では、推測しにくい長い文字列に変えてください。ローカルの `CF_ACCESS_CLIENT_ID` と `CF_ACCESS_CLIENT_SECRET` は、api と dashboard で同じ値にしてください。例のファイルは最初から揃っています。

`db:seed` は任意です（サンプル 10 件を入れます）。`@example.com` などのダミーだけで、実在の顧客データは入りません。

```bash
bun run db:seed   # 任意
bun run dev
```

パッケージのインストール、ワークスペース、テストは Bun です。Astro と wrangler の公開 CLI は shebang が Node で、`bun --bun` で Bun ランタイムに強制するとローカルの workerd との接続が失敗します（開発サーバーが 503 になる、または Vite プラグインが ECONNREFUSED になる）。`bun run` はこれらの CLI をそのまま起動します。

`bun run dev` は3つのサーバーをまとめて起動します。一覧が空のときは `bun run dev:api` が 8787 で動いているか、dashboard と api のサービストークンが一致しているかを確認してください。

ブラウザで http://localhost:4321/contact/ から送信し、http://localhost:4322/contacts/ に新しい行が増えることを確認します（`db:seed` を実行済みなら、サンプル 10 件に加えて 1 件増えます）。

## 2. D1 を作る

### Cloudflare への認証

対話できる端末なら `bunx wrangler login` でブラウザからログインします。CI やリモートの端末など、ブラウザを開けない環境では API トークンを使います。

```bash
export CLOUDFLARE_API_TOKEN=...      # My Profile → API Tokens で作ったユーザー API トークン
export CLOUDFLARE_ACCOUNT_ID=...     # Workers & Pages の概要に出る Account ID
bunx wrangler whoami                 # アカウント名と ID が出れば OK
```

トークンには少なくとも **Workers Scripts: Edit**、**D1: Edit**、**Workers KV Storage: Edit**（dashboard の `SESSION` を自動作成するため）、**Account Settings: Read** が要ります（目安）。Turnstile を API で作るなら **Turnstile Sites: Edit** も足します。トークンの値はシェル履歴やファイルに残さないでください。

### データベースを作る

```bash
cd apps/api
bunx wrangler d1 create astro-site-dashboard-db --location apac
```

`--location apac` は任意です。付けないと、コマンドを実行した場所に近いリージョンに作られます（海外のサーバーから実行すると北米などになります）。国内向けのサイトなら `apac` を指定します。

作成後に「Would you like Wrangler to add it on your behalf?」と聞かれたら **No** にします。Yes にすると、`astro_site_dashboard_db` という別名のバインディングが追記され、既存の `DB` と食い違います。

表示された `database_id` を `apps/api/wrangler.jsonc` の `d1_databases[0].database_id` に書き、仮の `00000000-0000-0000-0000-000000000000` を置き換えます。

```bash
bun run db:migrate:remote
```

`apps/api` にいるままでも、ルートでも実行できます。中身は `wrangler d1 migrations apply astro-site-dashboard-db --remote` です。確認を聞かれたら Yes にします。

`db:seed` はローカル D1 用です。本番の D1 には入れません。

ダッシュボードから作る場合は、Cloudflare の **Workers & Pages → D1 → Create** です。データベース名は `astro-site-dashboard-db` にします。

## 3. Worker をデプロイする

### 本番 URL を先に決める

workers.dev で公開する場合、URL はデプロイ前に分かります。形式は `https://<Worker 名>.<アカウントのサブドメイン>.workers.dev` です。サブドメインは **Workers & Pages → 概要** の右側（Subdomain）で確認します。まだ無ければ、そこで一度だけ登録します。既定の Worker 名なら次の3つです。

- web: `https://astro-site-dashboard-web.<サブドメイン>.workers.dev`
- api: `https://astro-site-dashboard-api.<サブドメイン>.workers.dev`
- dashboard: `https://astro-site-dashboard-dashboard.<サブドメイン>.workers.dev`

カスタムドメインを使う場合は、そのホスト名に読み替えます。

デプロイの**前**に、この URL を設定ファイルへ書きます。

- `apps/api/wrangler.jsonc` の `vars` … `WEB_ORIGIN`（web のオリジン）、`DASHBOARD_BASE_URL`（dashboard の URL）
- `apps/dashboard/wrangler.jsonc` の `vars` … `API_BASE_URL`（api の URL）、`PUBLIC_SITE_URL`（web の URL）

Turnstile を使う場合は、web をビルドする前に「6. Turnstile」で Site Key と Secret Key を用意しておきます。Site Key はビルド時に HTML へ埋め込まれるため、あとから入れると web の再デプロイが必要です。

### api

ルートから始めます。api はデプロイしたらすぐ「4. シークレット」の api の分を入れてください。`IP_HASH_SECRET` が無いあいだ、`POST /api/contact` は 500 を返します。

```bash
(cd apps/api && bunx wrangler deploy)
```

### web

web はビルド時に `PUBLIC_SITE_URL`、`PUBLIC_API_BASE_URL`、`PUBLIC_TURNSTILE_SITE_KEY` を読みます（フォームがブラウザから POST する api のオリジンが `PUBLIC_API_BASE_URL` です）。

**注意**: 「1. ローカル」でコピーした `apps/web/.env` があると、その値（`http://localhost:...` や空の Site Key）がシェルで渡した値より優先されることがあります。そのままビルドすると、デプロイは成功しても canonical・OGP が localhost を指し、フォームの送信先が `http://localhost:8787` になり、Turnstile も出ません。本番ビルドの間だけ `.env` を退避します（`.env.local` という名前は Vite が読むので使いません）。`bun run deploy` は退避を忘れた場合に備え、`.env` に localhost の `PUBLIC_SITE_URL` / `PUBLIC_API_BASE_URL` が残っていれば先にエラーで止まります。

```bash
cd apps/web
mv .env .env.dev-backup
PUBLIC_SITE_URL=https://astro-site-dashboard-web.<サブドメイン>.workers.dev \
PUBLIC_API_BASE_URL=https://astro-site-dashboard-api.<サブドメイン>.workers.dev \
PUBLIC_TURNSTILE_SITE_KEY=<Turnstile の Site Key> \
bun run deploy
mv .env.dev-backup .env
cd ../..
```

デプロイ後、`/contact/` の HTML に api の本番 URL（`data-api-base`）と Site Key が入っていること、`localhost` が残っていないことを確認します。

```bash
curl -s https://astro-site-dashboard-web.<サブドメイン>.workers.dev/contact/ | grep -o -E 'data-api-base="[^"]*"|localhost:[0-9]+'
```

### dashboard

```bash
(cd apps/dashboard && bun run deploy)
```

dashboard の初回デプロイでは、Astro のセッション用 KV（`astro-site-dashboard-dashboard-session`）が自動で作られます。Access（5. Cloudflare Access）を設定するまで、dashboard はすべて 403 になります。これは想定どおりです。

Cloudflare にログインしていない場合でも、`bun run build` と `bunx wrangler deploy --dry-run` でバンドルとバインディング名まで確認できます。一覧は [deployment.md](deployment.md) の「Cloudflare アカウントなしで確認できること」を参照してください。

## 4. シークレット

api で必須なのは `IP_HASH_SECRET` です。推測しにくい長い乱数にします。次は、使うものだけ入れます。

```bash
cd apps/api
openssl rand -base64 48 | tr -d '\n' | bunx wrangler secret put IP_HASH_SECRET
bunx wrangler secret put TURNSTILE_SECRET_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put CONTACT_NOTIFY_TO
bunx wrangler secret put CONTACT_FROM
bunx wrangler secret put CF_ACCESS_CLIENT_ID
bunx wrangler secret put CF_ACCESS_CLIENT_SECRET
bunx wrangler secret list   # 名前だけが出る。値は出ない
```

`CF_ACCESS_CLIENT_ID` と `CF_ACCESS_CLIENT_SECRET` は、Access のサービストークン（5. Cloudflare Access）の値です。Access をまだ設定しない場合は入れなくても受付（`POST /api/contact`）は動き、管理 API は 401 を返します。

dashboard では、api と同じサービストークンと、Access の検証値を入れます。

```bash
cd apps/dashboard
bunx wrangler secret put CF_ACCESS_CLIENT_ID
bunx wrangler secret put CF_ACCESS_CLIENT_SECRET
bunx wrangler secret put ACCESS_TEAM_DOMAIN
bunx wrangler secret put ACCESS_AUD
```

`wrangler secret put` は値をチャットやシェル履歴に残さないよう、プロンプトへ貼り付けてください。対話できない環境では、ファイルやコマンドから標準入力で渡せます（例: `bunx wrangler secret put TURNSTILE_SECRET_KEY < secret.txt`）。`echo` で値を書くとシェル履歴に残るので避けます。

## 5. Cloudflare Access

管理画面のドメイン全体を Access で保護します。一般の閲覧者は入れません。

Zero Trust は Free プラン（月 0 ドル、50 ユーザーまで）でも、有効化のときにカードか PayPal の登録を求められます。登録しない間は Access を設定できず、本番の dashboard は 403 のままです（受付の web と api は Access なしで動きます）。

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) を開く
2. **Access → Applications → Add an application → Self-hosted**
3. Application domain に dashboard のホスト名を入れる
4. **Policies** で Action を **Allow** にし、Include を **Emails** にして管理者のメールアドレスだけを入れる
5. 保存後、アプリケーションの概要にある **Application Audience (AUD) Tag** を `ACCESS_AUD` にする
6. チームドメイン（`<team>.cloudflareaccess.com`）を `ACCESS_TEAM_DOMAIN` にする。スキームは付けません

サービストークンは **Access → Service Auth → Service Tokens → Create Service Token** です。表示された Client ID と Client Secret を、api と dashboard の両方のシークレットに入れます。このトークンはブラウザへ出しません。

Access の前に Basic 認証を重ねる構成も取れますが、このボイラープレートの既定は Access だけです。

## 6. Turnstile

web をビルドする前に済ませます（Site Key がビルド時に埋め込まれるため）。

1. Cloudflare ダッシュボードの **Turnstile → Add widget**
2. ホスト名に公開サイトのホスト名を入れる（workers.dev なら `astro-site-dashboard-web.<サブドメイン>.workers.dev`。スキームは付けない）
3. Site Key を web の `PUBLIC_TURNSTILE_SITE_KEY` にする
4. Secret Key を api の `TURNSTILE_SECRET_KEY` にする

API で作る場合は `POST /accounts/{account_id}/challenges/widgets` に `{"name": "...", "domains": ["<ホスト名>"], "mode": "managed"}` を送ると、応答の `sitekey` と `secret` が得られます。`secret` は画面やログに出さず、そのまま `wrangler secret put` に渡します。

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
