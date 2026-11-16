# AGENTS.md

このファイルは、このリポジトリを AI（コーディング支援ツール）と一緒に使うための案内です。
利用者はプログラミングの専門家ではない場合があります。AI はこのファイルの内容を前提に作業してください。

## このリポジトリについて

小規模事業者のウェブサイト（LP）と、お問い合わせフォーム、その管理画面のセットです。

- `apps/web`: 公開サイト（Astro）。LP、お問い合わせページ（`/contact/`）、送信完了、プライバシーポリシー、利用規約
- `apps/api`: お問い合わせの受付 API（Hono / Cloudflare Workers）。データベース（D1）への接続はこのアプリだけが行います
- `apps/dashboard`: お問い合わせの管理画面（Astro SSR）。ログインは Cloudflare Access が担当し、アプリ内にログイン機能はありません
- `packages/contact-form`: フォームの項目・入力チェック・CSV 変換の定義（唯一の定義場所）
- `packages/site-config`: サイト名など、サイトごとの設定値
- `packages/auth`: Cloudflare Access の検証用部品
- `packages/analytics`: アクセス解析（GA4 等）の送信部品

詳しい手順は `docs/`（setup.md / deployment.md / customization.md）を先に読んでください。

## AI が作業するときの約束（利用者向け）

- 変更を始める前に、何を・なぜ変えるのかを、専門用語を避けて短く説明してください
- 次のような操作は、利用者の明示の指示があるときだけ実行してください
  - 本番へのデプロイ（`wrangler deploy`、リモート DB へのマイグレーション適用）
  - データの削除、DB の初期化
  - GitHub への push、リポジトリの公開設定の変更
- エラーが出たら、原因と対処を利用者が判断できる言葉で説明してください。同じ失敗を繰り返さないでください
- 作業の終わりには、変更したファイルと、確認した結果（テスト・ビルドの成否）を報告してください

## 壊してはいけない決まり

- データベース（D1）に接続するのは `apps/api` だけです。`apps/web` や `apps/dashboard` から直接つながないでください（dashboard は API 経由で読み書きします）
- フォームの項目を変えるときは、`packages/contact-form` の定義を正として直し、あわせてプライバシーポリシーの「取得する項目」の記載も同じ内容に直してください
- ログイン機能をアプリ内に追加しないでください。認証は Cloudflare Access の役割です
- 秘密情報（API キー、パスワード、トークン類）をコードやドキュメントに書かないでください。設定値は `.env` / `.dev.vars` に置き、リポジトリには `.env.example`（例のみ、実値なし）だけを置きます
- 実在の人物・事業者の情報や、実際の問い合わせデータをサンプルに使わないでください。サンプルはダミーと分かる内容にします
- このリポジトリの範囲外の機能（記事・ブログ機能、EC、決済、予約など）は、利用者の指示なしに追加しないでください

## よく使うコマンド

```bash
bun install          # 依存関係のインストール
bun run dev          # 3アプリ同時起動（web: 4321 / dashboard: 4322 / api: 8787）
bun run check        # 型チェック
bun test             # テスト
bun run lint         # Biome によるチェック
bun run build        # 全アプリのビルド
bun run db:migrate:local   # ローカル DB へのマイグレーション
bun run db:seed            # ダミーデータの投入
```

変更後は `bun run check`、`bun test`、`bun run build` が通ることを確認してから完了としてください。

## カスタマイズの入口

- サイト名・連絡先などの値は `packages/site-config` にあります
- 文面や色の変え方は `docs/customization.md` にあります
- 環境変数の一覧は `docs/deployment.md` にあります
