# astro-site-dashboard-boilerplate

Astro のウェブサイトと、問い合わせを管理するダッシュボードを1つのモノレポにまとめたボイラープレートです。フォームの受付は Cloudflare Workers 上の API が行い、データは Cloudflare D1 に保存します。ホスティングも Workers だけで、月額の固定費を増やさない構成が既定です。

想定しているのは、国内の小規模な店舗や事業者のサイトを作る人です。clone してサイト名や環境変数を差し替えれば、そのまま運用を始められます。

## 構成

```text
apps/web         公開サイト（LP・お問い合わせ・ポリシー）。静的生成
apps/dashboard   管理画面（Astro SSR + shadcn/ui）。Cloudflare Access の配下
apps/api         Hono。D1 への読み書きはここだけ
packages/contact-form   フォームの Zod スキーマと CSV
packages/site-config    サイト名・連絡先
packages/auth           Access JWT の検証
packages/analytics      GA4 イベント（個人情報は載らない）
```

```text
ブラウザ ──POST /api/contact──▶ api ──▶ D1
                              └──▶ Resend（任意）
dashboard（SSR）──サービストークン──▶ api ──▶ D1
```

開発時のポートは web `4321`、dashboard `4322`、api `8787` です。

## クイックスタート

必要なものは [Bun](https://bun.sh) だけです。Node.js は使いません。

```bash
bun install
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
bun run db:migrate:local
bun run db:seed
bun run dev
```

`bun run dev` は mprocs で3つの開発サーバーを同時に起動します。どれか1つだけなら `bun run dev:web`、`bun run dev:dashboard`、`bun run dev:api` です。

- サイト: http://localhost:4321/
- お問い合わせ: http://localhost:4321/contact/
- 管理画面: http://localhost:4322/contacts/
- 死活確認: http://localhost:8787/api/health

ローカルの管理画面は、Access のチームドメインと AUD が空のあいだだけ JWT 検証を省略します。本番ビルドでは未設定だと 403 になります。api と dashboard の `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` は、例のファイルでは同じダミー値です。本番では必ず差し替えてください。

Cloudflare へのデプロイ、Access、Turnstile、Resend、GA4 は [docs/setup.md](docs/setup.md) です。

## 機能

- LP（`/`）。フォームは載せず、`/contact/` へ誘導する
- お問い合わせ（名前は任意、メールと本文は必須）。Turnstile、ハニーポット、レート制限
- 送信完了 `/contact/thanks/`、プライバシーポリシー `/privacy/`、利用規約 `/terms/`
- 管理画面での一覧・検索・ステータス・管理メモ・論理削除・CSV（BOM 付き UTF-8）
- 通知メール（Resend）。キーが無いときは保存だけして成功する
- `DEMO_MODE=true` のあいだは保存も通知もしない

## ポリシー文面

同梱のプライバシーポリシーと利用規約は雛形であり、法的助言ではありません。そのまま公開せず、取得している項目と実態に合わせて書き換えてください。必要なら法律の専門家に相談してください。

文面の見直しには [kiyaku.jp](https://kiyaku.jp/index.html) のひな型が参考になります。同サイトも「ひな型は一例であり、実態に合わせて追加・修正・削除すること」「法令が反映されていない場合がある」としています。このリポジトリの文面は、そのひな型をそのまま転載したものではなく、このボイラープレートのフォーム項目と外部サービスに合わせて書き起こしたものです。

特定商取引法に基づく表記は同梱していません。ネットで販売する場合は、利用者側で追加してください。手順は [docs/customization.md](docs/customization.md) にあります。

## この版に入っていないもの

EC、予約、会員登録、決済、複数管理者、多言語、記事とお知らせ、メールの自動返信、作成用 CLI は入れていません。必要になったものは次の版で判断します。作成 CLI（`lp` / `form` / `minimal`）は後から追加する予定です。

## 依存の更新

Dependabot や Renovate は入れていません。更新するときは、対象の `package.json` を直してからルートで `bun install` し、`bun run check`、`bun test`、`bun run build` が通ることを確認して lockfile をコミットします。
