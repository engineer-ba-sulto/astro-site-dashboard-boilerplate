# 差し替え

## サイト名と色

サイト名・説明・住所・電話・メールは `packages/site-config/src/index.ts` だけを変えます。ヘッダー、タイトル、フッター、会社概要、ポリシーの事業者名はここを参照します。URL だけは `PUBLIC_SITE_URL` で上書きします。

色は `apps/web/src/styles/global.css` の `@theme` です。`--color-main` がボタンと見出しのアクセント、`--color-accent` が番号の差し色です。dashboard の色は `apps/dashboard/src/styles/global.css` の CSS 変数です。共通のデザイントークン用パッケージはありません。

LP の見出しや FAQ は `apps/web/src/data/lp.ts` です。FAQ の構造化データもこの配列から出るので、質問文を変えたら画面と JSON-LD は一緒に変わります。

## パッケージ名 `@repo`

ワークスペースの名前は `@repo/contact-form` のように `@repo` で固定しています。自分のスコープに変えるときは、各 `packages/*/package.json` の `name` と、それを import しているファイル、`package.json` の `dependencies` を同じ文字列に揃えて `bun install` し直します。

## フォーム項目

項目の正は `packages/contact-form` です。追加や削除をしたら、次を同じ変更にします。

1. `packages/contact-form/src/schema.ts` と `constants.ts`
2. `packages/contact-form/src/contact-form.test.ts`
3. `apps/web/src/components/ContactForm.astro`
4. `apps/api/src/db/schema.ts` を変えた場合は `bun run db:generate` でマイグレーションを足す
5. `apps/web/src/pages/privacy.astro` の「取得する情報」

名前は任意です。空文字は未入力として保存します。プライバシーポリシーに書く取得項目と、このスキーマは常に一致させてください。

## ポリシー

`apps/web/src/pages/privacy.astro` と `apps/web/src/pages/terms.astro` を、実際の事業者名・窓口・外部サービスに合わせて書き換えます。各ページ先頭の注記（雛形であり法的助言ではない）は、公開前に読んだうえで、必要なら文面は残してください。

見直しのたたき台には [kiyaku.jp](https://kiyaku.jp/index.html) が使えます。同サイトの注意どおり、ひな型は一例なので、実態に合わせて追加・修正・削除してください。法令が反映されていない場合もあります。このリポジトリの文面は、ひな型の全文を転載したものではありません。

ページを外すときは、その `.astro` を削除し、`apps/web/src/components/Footer.astro` のリンクも消します。同意チェックのリンク先を別の URL にする場合は、`ContactForm.astro` の `/privacy/` をその URL に変えます。

特定商取引法に基づく表記は入れていません。販売をするときは、kiyaku.jp の「特定商取引法に基づく表記」のひな型を参考に、自分のページとして追加してください。

## Worker 名

既定は `astro-site-dashboard-web`、`astro-site-dashboard-dashboard`、`astro-site-dashboard-api`、D1 は `astro-site-dashboard-db` です。変える場合は各 `wrangler.jsonc` の `name` と、マイグレーションコマンドが参照するデータベース名を揃えます。

## レート制限

Cloudflare の Rate Limiting バインディングは、期間を 10 秒か 60 秒にしかできません。`wrangler.jsonc` では 60 秒に 5 回です。仕様の「10 分に 5 回」は、直近 10 分の受付が 5 件以上なら 429 にする処理で満たしています。数える単位は、IPv4 ではそのアドレス、IPv6 ではアドレス全体ではなく /64 の範囲です（末尾の端末番号だけ変えても同じ枠になります）。デモモードでもこの 10 分の上限は同じです。問い合わせの本文は保存しませんが、回数だけは IP のハッシュと時刻で数えます。閾値は `apps/api/src/lib/ratelimit.ts` です。

## Biome の astro ドメイン

`drizzle` ドメイン（WHERE のない更新・削除の禁止）は有効です。`astro` ドメインは、テンプレートでしか参照しない frontmatter の変数を未使用と誤検知したため無効にしています。
