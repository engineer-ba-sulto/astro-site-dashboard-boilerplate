# Astro モノレポ・ボイラープレート実装計画

- 作成日: 2026-11-04（計画書から分離）
- 位置づけ: 計画書 `astro-monorepo-boilerplate-plan-2026-11-04.md` の実装編。方針と決定事項（D1〜D19）は計画書が正で、本書は仕様（§1）とチケット別の作業計画（§2）を担う
- 状態: **計画確定。実装はユーザー側で実施する**。リポジトリ作成・GitHub への反映も未実施
- 読み方: §1 の仕様が確定値。食い違う場合は本書側を先に改訂する（§1.10 の判断ルール）

---

## 1. 詳細実装仕様

実装者がそのまま着手できる粒度に落とした仕様。ここに書いた数値・命名はすべて本節で確定とし、変える場合は本書を改訂してから実装する。

### 1.1 バージョン方針

- ランタイム / パッケージマネージャ: **Bun**（`packageManager` でバージョンを固定）。Node は使わない
- Astro: kurashiwake 本番と同系の**最新安定メジャー**。Hono 4 系、Drizzle ORM は最新安定、Zod は最新安定メジャー、Biome は **v2.6 系**
- 依存は `^` 指定 + `bun.lock` で固定。Dependabot / Renovate は v1 では入れず、更新は手動（手順は docs に書く）
- アプリの雛形生成は **C3（create-cloudflare）** で行う（T2）。C3 が入れるアダプタや wrangler のバージョンが土台になるので、生成後にバージョンを §1.1 の方針へ寄せて lockfile で固定する

### 1.2 リポジトリ構成（確定形）

```text
astro-site-dashboard-boilerplate/
  package.json            # workspaces: apps/*, packages/* / 共通スクリプト
  bunfig.toml             # Bun の設定（1.2.1）
  mprocs.yaml             # 開発サーバー3つの並行起動（1.2.2）
  biome.json
  tsconfig.base.json
  bun.lock
  .gitignore
  .github/workflows/ci.yml
  LICENSE                 # MIT
  README.md
  docs/
    setup.md              # 0 から動かすまで（Cloudflare / Access / Resend / Turnstile / GA4）
    customization.md      # サイト名・スコープ・フォーム項目・ポリシーの変更手順（kiyaku.jp 参照を含む）
    deployment.md         # 本番デプロイと環境変数の一覧
  apps/
    web/                  # Astro（@astrojs/cloudflare、LP 1ページ構成。D17）
      astro.config.ts / wrangler.jsonc（C3 生成形式）/ .env.example
      src/layouts/        # SiteLayout.astro
      src/components/     # Header / Footer / ContactForm / Analytics（このアプリ専用。D11）
      src/styles/
      src/pages/ …（1.5 のルート表）
    dashboard/            # Astro SSR（Access 配下）
      astro.config.ts / wrangler.jsonc（C3 生成形式）/ .env.example
      src/pages/ …（1.6 の画面表）
      src/components/ui/  # shadcn/ui の部品（取り込み方式。D5 改訂）
      src/server/         # API クライアント（サービストークン保持はここだけ）
    api/                  # Hono on Workers
      wrangler.jsonc      # D1 バインディング DB はここだけ（C3 生成形式）
      drizzle.config.ts
      src/index.ts        # ルート定義
      src/routes/contact.ts / admin.ts / health.ts
      src/db/schema.ts / client.ts / migrations/
      src/mail/notify.ts  # Resend 薄ラッパー
      src/lib/turnstile.ts / ratelimit.ts / auth.ts
  packages/
    contact-form/         # @repo/contact-form（Zod スキーマ + 型 + ステータス定義、純粋 TS）
    site-config/          # @repo/site-config（サイト名・URL・メール等の定数と型）
    auth/                 # @repo/auth（Access JWT 検証ヘルパー）
    analytics/            # @repo/analytics（GA4 イベントの型付きヘルパー）
```

ルートの共通スクリプト: `dev`（mprocs で3アプリ並行起動）/ `dev:web`・`dev:dashboard`・`dev:api`（単独起動）/ `build` / `check`（astro check + tsc）/ `test`（bun test）/ `lint`・`format`（Biome）/ `db:generate`・`db:migrate:local`・`db:migrate:remote`（api ワークスペースへ委譲）。

開発時のポート: web `4321`、dashboard `4322`、api `8787`（wrangler dev）。dashboard は `API_BASE_URL=http://localhost:8787` で api を指す。

#### 1.2.1 bunfig.toml（ルートに置く）

中身は **kurashiwake リポジトリ（`project/bunfig.toml`）と同一**にする（2026-11-04 確認、本番の現物）。

```toml
[install]
linker = "isolated"
```

- `linker = "isolated"`: pnpm 型の厳格な node_modules 配置。ワークスペース間の依存は、使っているパッケージに必ず宣言する必要がある（宣言漏れは動かないので、テンプレートとしての健全性チェックにもなる）
- それ以外の設定（telemetry、frozenLockfile、カバレッジ等）は入れない。lockfile の固定は CI コマンド側の `--frozen-lockfile` で行う（§1.8）
- 置くのはルートのみ。各アプリ・パッケージには置かない

#### 1.2.2 mprocs（開発サーバーの並行起動）

ルートの `bun run dev` は **mprocs** を起動し、web / dashboard / api の開発サーバーを1画面で並行管理する。mprocs 本体はルートの devDependency として入れる（`bun install` だけで揃い、別途インストールを求めない）。

`mprocs.yaml` はプロセス定義のみ:

```yaml
procs:
  web:
    shell: "cd apps/web && bun run dev"
  dashboard:
    shell: "cd apps/dashboard && bun run dev"
  api:
    shell: "cd apps/api && bun run dev"
```

- 3つとも自動起動。個別に止める・再起動する操作は mprocs の画面側で行う
- 単独起動したい時は `dev:web` などのルートスクリプトを使う（mprocs を経由しない）
- 本番・CI では使わない（開発専用）


### 1.3 データ定義（D1 / Drizzle）

テーブルは v1 では `contacts` のみ。時刻はすべて **UNIX 秒（INTEGER）** で持ち、表示時に JST へ変換する。

| カラム | 型 | 制約・備考 |
|---|---|---|
| id | INTEGER | PK AUTOINCREMENT |
| name | TEXT | NULL 可（任意項目。2026-11-09 に必須から変更。理由: 情報漏洩時に被害を最小にするため、収集する個人情報を最小限にする） |
| email | TEXT | NOT NULL |
| category | TEXT | NULL 可。値の列挙はアプリ側（Zod）で担保 |
| message | TEXT | NOT NULL |
| status | TEXT | NOT NULL DEFAULT 'new'。値は `new` / `in_progress` / `done` / `spam`（`@repo/contact-form` で定義） |
| admin_note | TEXT | NULL 可。管理者のみ閲覧可 |
| ip_hash | TEXT | 生 IP は保存しない。`IP_HASH_SECRET` で HMAC ハッシュ化 |
| user_agent | TEXT | NULL 可（スパム判定の参考） |
| created_at | INTEGER | NOT NULL（登録時にアプリ側でセット） |
| updated_at | INTEGER | NOT NULL（更新時にアプリ側でセット） |
| deleted_at | INTEGER | NULL 可。論理削除 |

インデックス: `(status, created_at)` と `(created_at)` の2本。

- Drizzle スキーマは `apps/api/src/db/schema.ts`。`drizzle-kit generate` で `src/db/migrations/` に SQL を生成し、適用は `wrangler d1 migrations apply`（local / remote）
- 開発・デモ用のダミーデータ投入スクリプト `apps/api/scripts/seed.ts` を用意する（ダミー10件程度、実データと混ざらない文面にする）

### 1.4 フォーム項目とバリデーション（`@repo/contact-form` が単一の情報源）

| 項目 | 必須 | 制約 |
|---|---|---|
| name | 任意 | 100 文字まで（未入力可。空文字は未入力として扱う） |
| email | ○ | メール形式、254 文字まで |
| category | 任意 | 列挙: `general`（一般）/ `work`（仕事の相談）/ `other`（その他） |
| message | ○ | 1〜5000 文字 |
| privacy_agreed | ○ | `true` 必須（同意チェック） |
| turnstile_token | 条件付き | Turnstile 有効時のみ必須。検証は API 側 |
| website（ハニーポット） | 内部項目 | 画面には表示しない隠しフィールド。人間は入力しない前提で、値が入っていたらボットとみなす。利用者向けの項目ではないので、プライバシーの取得項目には含めない |

プライバシーポリシーの「取得項目」はこの表と一致させる（計画書 §6.2 の単一情報源ルール）。

### 1.5 API 契約（apps/api）

共通: レスポンスは JSON。エラー形式は `{ "error": { "code": string, "message": string}}` に統一する。

| メソッド / パス | 認証 | 内容 | 主な応答 |
|---|---|---|---|
| `GET /api/health` | なし | 死活確認 | 200 `{ ok: true}` |
| `POST /api/contact` | なし（Turnstile + レート制限） | フォーム受付 → D1 保存 → Resend 通知（設定時のみ）。デモモード時は保存・通知なしで 201 を返す | 201 `{ id}` / 400 `VALIDATION_ERROR`・`TURNSTILE_FAILED` / 429 `RATE_LIMITED` |
| `GET /api/admin/contacts` | サービストークン | 一覧。クエリ: `status`（絞り込み）、`q`（名前・メール・本文の部分一致）、`page`（既定1）、`perPage`（既定20、最大100）。`deleted_at` ありは除外 | 200 `{ items, total, page, perPage}` |
| `GET /api/admin/contacts/:id` | サービストークン | 詳細（admin_note を含む） | 200 / 404 `NOT_FOUND` |
| `PATCH /api/admin/contacts/:id` | サービストークン | `status` と `admin_note` の更新（Zod 検証） | 200 / 400 / 404 |
| `DELETE /api/admin/contacts/:id` | サービストークン | 論理削除（`deleted_at` をセット） | 204 |
| `GET /api/admin/contacts/export.csv` | サービストークン | 一覧と同じ絞り込みで CSV 出力。**BOM 付き UTF-8**（Excel で文字化けしないため）、上限 10,000 件 | 200 text/csv |

- レート制限: Cloudflare の Rate Limiting バインディングを使い、同一 IP ハッシュで **10 分に 5 回** まで。超過は 429
- ハニーポット: `website` フィールドに値が入っていた場合は、保存も通知もせずに 201 を返して正常に見せる（ボットに失敗を学習させない）
- `/api/admin/*` の認証: dashboard サーバーからのリクエストに限る。Cloudflare Access のサービストークン（`CF-Access-Client-Id` / `CF-Access-Client-Secret` ヘッダー）を api 側で検証し、不一致は 401 `UNAUTHORIZED`
- 通知メール（Resend）: 件名は `[サイト名] 新しいお問い合わせ（カテゴリ）` の型、本文はプレーンテキスト + 最小 HTML の2形式で、項目一覧と dashboard の詳細 URL を含める。Reply-To は送信者のアドレス。送信失敗はログのみで、受付は成功扱い（計画書 §7.5）

### 1.6 画面仕様

apps/web のルート:

| パス | 内容 |
|---|---|
| `/` | LP 本体（計画書 §6.1 のセクション構成。フォームは載せない。D13 / D17 / D19） |
| `/contact/` | お問い合わせフォーム（独立ページ。§1.4 の項目。D19） |
| `/contact/thanks/` | 送信完了（フォーム送信後の遷移先） |
| `/privacy/` `/terms/` | ポリシー2点（静的ページ。クッキーと外部送信は `/privacy/` 内の一節、特定商取引法表記は同梱しない。D18） |
| `/sitemap-index.xml` ・ `/robots.txt` | サイトマップ（LP + お問い合わせ + ポリシー + 送信完了）、robots |

記事・お知らせのルートと RSS は作らない（D13）。独立した `/about/` ページは作らない（`/contact/` は D19 で作る）。

サンプルコンテンツ: LP の各セクション文面、フォームの案内文、ポリシー2点。すべてダミー文面と明記する。

apps/dashboard の画面（すべて SSR、Access 配下）:

| パス | 内容 |
|---|---|
| `/` → `/contacts/` | 問い合わせ一覧: 表（受信日時・名前・カテゴリ・件名相当（本文冒頭）・ステータス）、ステータス絞り込み、キーワード検索、ページング（20件/ページ）、CSV ダウンロードボタン、未対応（new）件数バッジ。名前が未入力の行は「（名前なし）」と表示する |
| `/contacts/<id>/` | 詳細: 全項目表示、ステータス変更（select + 保存）、管理メモ編集、論理削除ボタン（確認ダイアログ付き）。更新後は一覧へ戻る |

- dashboard から api への呼び出しは `src/server/` のクライアント経由のみ。ブラウザ側 JS から api を直接叩かない
- dashboard 自体の保護は Cloudflare Access（D4）。アプリ内では Access の JWT（`Cf-Access-Jwt-Assertion`）を `@repo/auth` で検証し、検証できないリクエストは 403 を表示する

### 1.7 環境変数マスター

| 変数 | 置き場所 | 用途 | 未設定時 |
|---|---|---|---|
| `PUBLIC_SITE_URL` | web / dashboard | サイトの正 URL（OGP・サイトマップ・メール内リンク） | localhost |
| `PUBLIC_GA4_MEASUREMENT_ID` | web | GA4（計画書 §6.4） | タグを出力しない |
| `PUBLIC_CF_WEB_ANALYTICS_TOKEN` | web | Cloudflare Web Analytics | タグを出力しない |
| `PUBLIC_TURNSTILE_SITE_KEY` | web | Turnstile ウィジェット | フォームの検証を無効化 |
| `API_BASE_URL` | dashboard（サーバー側） | api の URL | — （必須） |
| `TURNSTILE_SECRET_KEY` | api（secret） | Turnstile 検証 | 検証をスキップ |
| `IP_HASH_SECRET` | api（secret） | IP ハッシュ化 | — （必須） |
| `RESEND_API_KEY` | api（secret） | メール通知 | 保存のみ、通知なし |
| `CONTACT_NOTIFY_TO` / `CONTACT_FROM` | api | 通知先 / 送信元 | 同上 |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | dashboard（secret） | api へ渡すサービストークン | — （本番では必須） |
| `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` | dashboard | Access JWT の検証（発行者・対象） | — （本番では必須） |
| `DEMO_MODE` | api | `true` の間、保存・通知をしない（D8） | 通常動作 |

Cloudflare 側の名前（wrangler の `name`）は `astro-site-dashboard-web` / `-dashboard` / `-api`、D1 は `astro-site-dashboard-db` を既定とし、変える場合は docs に従う前提で wrangler.jsonc のコメントに明記する。

### 1.8 CI とテスト

- GitHub Actions（`.github/workflows/ci.yml`）: push / Pull Request で `bun install --frozen-lockfile` → `biome ci` → `bun run check` → `bun test` → `bun run build`（web / api のビルド確認まで。デプロイは CI から行わない）
- テスト範囲（`bun test`）: `@repo/contact-form` の Zod スキーマ（正常系・境界値・必須漏れ）、api のバリデーションとステータス遷移の分岐、CSV 変換。E2E は v1 では入れない
- Biome: ルート `biome.json` 一枚。`drizzle` ドメイン（WHERE なし削除・更新の禁止）は有効化必須、`astro` ドメイン（nursery）は T2 で挙動を確認してから有効化を判断する

### 1.9 実装手順（T2〜T16 の実施順と完了条件）

依存順に実施する。各ステップの完了条件は「条件を満たし、CI が通ること」。

1. **T2 土台**: 1.2 の構成ツリー（bunfig.toml、mprocs.yaml を含む）を作成し、`bun install` と空アプリの `bun run dev`（mprocs で3つ並行起動）が通る。CI が緑
2. **T3 サイト基盤**: site-config と基本レイアウト（Header / Footer）が web に表示される
3. **T4 LP**: `/` に LP（フォームは載せない）が表示され、`/contact/` にフォームページが表示される
4. **T5 ポリシー**: ポリシー2ページ（プライバシー・利用規約）が静的ページとして表示される
5. **T7 スキーマ基盤**: `@repo/contact-form` の Zod スキーマ + テストが通る（T6 解析は独立に並行可）
6. **T8 API**: `/api/contact` が Turnstile 検証 → D1 保存まで通る。Drizzle マイグレーションが local / remote 両方で適用できる
7. **T9 フォーム UI**: web のフォームから送信し、D1 にレコードが入る。完了ページへ遷移する
8. **T10 通知**: Resend 設定時に通知メールが届く。未設定時は保存のみで完結する
9. **T11 dashboard**: Access 配下で一覧・詳細・ステータス変更・論理削除・CSV が api 経由で動く
10. **T12 ドキュメント**: README と docs 3点で、クリーンクローンから 計画書 §10 の再現手順が通る
11. **T13 サンプル整備 / T14 再現テスト / T15 公開**: 計画書 §10 チェックリストをすべて通過して v0.1.0
12. **T17 作成 CLI（後日、v0.1.0 対象外）**: `npm create astro-site-dashboard-boilerplate` で `--template lp`（既定）・`form`・`minimal` のすべてが生成でき、生成物がそのまま dev 起動できる
12. **T16 デモ公開（v1.0 向け）**: 配布物の LP をデモモードでデモ公開し、dashboard のスクリーンショットを README に追加

### 1.10 実装時の判断ルール

- 本書と実装が食い違う場合は、勝手に広げず本書側を先に改訂する（とくに §1.3 のデータ定義、§1.4 のフォーム項目、§1.5 の API 契約）
- v1 の範囲外（計画書 §3）は、実装中に欲しくなっても入れない。必要なら v2 の候補として README のロードマップに書く

### 1.11 作成 CLI とテンプレート（計画書 D16、2026-11-11。導入時期は後日、v0.1.0 対象外）

プロジェクトの作成は、EmDash の `create-emdash` と同じ形の専用 CLI で行う。**ただし CLI の実装と公開は後日とし、v0.1.0 は clone（GitHub Template）で公開する（2026-11-11 ユーザー決定）。本節の仕様とテンプレート定義は、後日そのまま実装できるよう先に確定しておく。**パッケージ名は `create-astro-site-dashboard-boilerplate`（リポジトリ内 `packages/create/` に置き、npm に公開する）。`npm create` の規約で起動する:

```
npm create astro-site-dashboard-boilerplate@latest <dir> --template <key> [--pm bun] [--install | --no-install] [--yes] [--force]
```

- フラグで未指定の項目は対話で聞く（プロジェクト名、テンプレート、パッケージマネージャ、依存関係を入れるか）。`--yes` は未指定を既定値で進める。空でないフォルダへの上書きは `--force` 併用時のみ
- テンプレート: `lp`（既定。LP 形の配布物そのもの）、`form`（apps/web はフォーム一式のみ。D17 で置き換えられた D14 の形。自分のデザインへフォームだけ組み込む人向け）、`minimal`（apps/web なし: api + dashboard + packages + docs。自分の既存サイトへフォームを組み込む人向け）
- テンプレートごとの複製は持たない。CLI は基底（リポジトリ本体）を giget で取得し、テンプレート差分を適用して生成する（`minimal` なら apps/web を除き、ルートの dev スクリプトと docs の該当箇所を落とす）。テンプレートが増えて差分で表せなくなったら、その時点で複製方式を再検討する
- 生成時に行うこと: 取得（.git なし）、テンプレート差分の適用、プロジェクト名の反映（ルート package.json の name と各 wrangler.jsonc の name）、`IP_HASH_SECRET` の生成（api のローカル用 `.dev.vars` へ。gitignore 済み。本番分は wrangler secret で別途設定する旨を案内する）、`--install` 指定時は `bun install`、最後に次の手順（環境変数、ポリシー文面の見直し、`bun run dev`、docs へのリンク）を表示する
- v0.1.0 の作成方法は clone 方式（GitHub Template）のみ。CLI 導入後は CLI を正規とし、clone も併用できる形にする

---

## 2. チケット別実装計画

§1.9 の実施順に沿った、チケット単位の作業計画。各チケットは「作業 → 検証」の順に進め、検証を通してから次へ進む。ファイルパスは §1.2 の構成ツリーが前提。

### T2 モノレポ初期化

作業:
1. ルートに `package.json`（workspaces: `apps/*`, `packages/*`、`packageManager` で Bun のバージョンを固定）、`bunfig.toml`（§1.2.1）、`mprocs.yaml`（§1.2.2）、`tsconfig.base.json`（strict、パスエイリアスは使わずパッケージ名で参照）、`.gitignore`（node_modules、dist、.wrangler、.env 系、.dev.vars）を作成
2. `biome.json` をルートに作成。`drizzle` ドメインを有効化し、`astro` ドメインはこの時点で有効化して挙動を確認する（問題があれば無効のまま理由を本書へ記録）
3. apps 3つは **C3（create-cloudflare）で生成する**（2026-11-04 指定）。web / dashboard は Astro、api は Hono。プラットフォームは **Workers のみ（Pages は使わない**。2026-11-04 明示）。デプロイと git 初期化は C3 側では行わない

   ```bash
   bunx create-cloudflare@latest apps/web --framework=astro --platform=workers --no-deploy --git=false --lang=ts
   bunx create-cloudflare@latest apps/dashboard --framework=astro --platform=workers --no-deploy --git=false --lang=ts
   bunx create-cloudflare@latest apps/api --framework=hono --platform=workers --no-deploy --git=false --lang=ts
   ```

   生成後の調整: 個別の lockfile ができていれば削除してルートの `bun install` に一本化する／各アプリの `package.json` の name と wrangler.jsonc の `name` を §1.7 の既定に合わせる／api は `GET /api/health` のみに削る
3.5. **shadcn/ui と Tailwind CSS の土台を入れる**（計画書 D5 改訂、2026-11-09）: `@astrojs/react` を dashboard の astro.config に追加し、shadcn/ui を初期化する（部品は `apps/dashboard/src/components/ui/` へ取り込む方式）。Tailwind CSS（v4、`@tailwindcss/vite` プラグイン）は **web と dashboard の両方**に導入し、CSS の書き方を統一する。React を入れるのは dashboard のみで、web には入れない。api は対象外
4. packages 4つ（contact-form / site-config / auth / analytics）の雛形を作成（各 `package.json` の name は §1.2 のとおり。依存は `workspace:*`）
5. ルートスクリプト（§1.2）を設定し、`.github/workflows/ci.yml` を §1.8 の順序で作成

検証: `bun install` が通る／`bun run dev` で mprocs から3つ起動し、web 4321・dashboard 4322・api 8787（`/api/health` が 200）を目視確認／CI が緑

### T3 サイト基盤

作業:
1. `@repo/site-config`: サイト名・説明・URL・メールアドレス・運営者名の定数と型を定義（値はすべてダミー）。環境変数で上書きできる項目は `PUBLIC_SITE_URL` のみとする
2. apps/web 内に置く: `src/layouts/SiteLayout.astro`（head、OGP、Analytics 受け口）、`src/components/Header.astro`、`src/components/Footer.astro`（ポリシーへのリンク一式を含む）。スタイルは apps/web の `src/styles/` で閉じる。共有パッケージにはしない（計画書 D11）
3. apps/web: `astro.config.ts`（`@astrojs/cloudflare`、LP・ポリシー・送信完了ページの静的生成設定）、各ページに最小レイアウトを適用

検証: トップページが表示される／サイト名を site-config で変えるとヘッダーと title が追随する／`bun run check` が通る

### T4 コンテンツ基盤

作業:
1. apps/web に LP を実装する: `/`（計画書 §6.1 のセクション構成。フォームは載せない）と `/contact/`（ContactForm を配置）と `/contact/thanks/`（D13 / D17 / D19）。Content Collections は使わない
2. LP の各セクションとフォームの案内文にサンプル文面を作成（ダミー事業者の文面と明記）
4. サイトマップ（LP + お問い合わせ + ポリシー + 送信完了）と robots.txt を用意する。RSS は作らない

検証: LP と送信完了が表示される／フォームが LP 内で送信できる／ビルド成果物に各ページの HTML が静的生成されている

### T5 ポリシーページ

作業:
1. 計画書 §6.2 の方針で、プライバシーポリシーと利用規約の2本を、kiyaku.jp を参考にこのボイラープレートの実態に合わせて書き起こす。クッキーと外部送信先の開示は、独立ページにせずプライバシーポリシーの中の一節として入れる。特定商取引法に基づく表記は同梱しない（販売する利用者が自分で追加する旨を docs に書く）
2. 静的ページとして `/privacy/` `/terms/` で表示する（Content Collections は使わない）。プライバシーの取得項目は §1.4 の表と一致させる
3. 各ページの管理メモに「雛形であり法的助言ではない。そのまま使わず実態に合わせて修正すること」旨を残し、フッターから2ページともへリンクする

検証: 2ページが表示される／プライバシーの取得項目と §1.4 が一致する／フッターのリンク切れがない

### T6 アクセス解析

作業:
1. apps/web の `src/components/Analytics.astro` を作成し、SiteLayout から読み込む。`PUBLIC_CF_WEB_ANALYTICS_TOKEN` と `PUBLIC_GA4_MEASUREMENT_ID` が設定された場合のみ、それぞれのタグを出力する
2. `@repo/analytics`: GA4 イベント送信の型付きヘルパーを作成（イベント名とパラメータの型を定義。個人情報を載せるパラメータは型に入れない）
3. フォーム送信完了イベントの送信ポイントを決め、T9 で接続する前提で TODO コメントを残す
4. JSON-LD（構造化データ）を SiteLayout から出力する（2026-11-11 追加）: 事業者情報（LocalBusiness。名称・住所・電話などは site-config の値から生成し、未設定の項目は出さない）と、LP の FAQ セクションの内容から生成する FAQPage の2種。FAQ の文面と構造化データがずれないよう、生成元は LP の FAQ データ1か所にする

検証: 環境変数なしではタグが一切出力されない／GA4 の ID を入れた場合のみ gtag が出る／Cloudflare のトークンも同様／LP の HTML に LocalBusiness と FAQPage の JSON-LD が含まれ、FAQ の質問・回答が画面表示と一致する

### T7 フォーム基盤（`@repo/contact-form`）

作業:
1. ステータス定義（`new` / `in_progress` / `done` / `spam`）、カテゴリ定義（§1.4）、送信入力の Zod スキーマ、管理側更新（status・admin_note）の Zod スキーマを作成
2. CSV 変換の純粋関数（BOM 付き UTF-8、ヘッダー行は日本語ラベル、改行・カンマ・引用符のエスケープ）を作成
3. テストを作成: スキーマの正常系・必須漏れ・文字数境界（100 / 254 / 5000 の前後）、CSV のエスケープと BOM

検証: `bun test` がすべて通る／このパッケージが DOM・Astro・Cloudflare のいずれにも依存していない（import の確認）

### T8 API（受付）

作業:
1. apps/api の土台: Hono アプリ、エラー形式（§1.5）の共通化、`/api/health`
2. Drizzle スキーマ（§1.3）を `src/db/schema.ts` に書き、`drizzle-kit generate` で初回マイグレーションを生成。`wrangler.jsonc` に D1 バインディング `DB` と Rate Limiting バインディングを設定
3. `POST /api/contact` を実装: Turnstile 検証（secret 未設定時はスキップ）→ Zod 検証 → レート制限（§1.5）→ IP ハッシュ化 → D1 保存。`DEMO_MODE=true` の時は保存せず 201 を返す
4. 開発用シード `scripts/seed.ts`（ダミー10件）を作成

検証: ローカル D1 へマイグレーション適用 → curl で正常送信が 201 かつレコードが入る／不正な入力は 400 `VALIDATION_ERROR`／連続送信で 429／デモモードではレコードが増えない

### T9 フォーム UI

作業:
1. apps/web の `src/components/ContactForm.astro`: §1.4 の項目、クライアント側の即時バリデーション（`@repo/contact-form` の共有スキーマを import）、送信中は二重送信防止、失敗時は入力を保持
2. Turnstile ウィジェットはサイトキー設定時のみ表示する
3. apps/web の `/contact/` に配置し、送信成功で `/contact/thanks/` へ遷移。T6 の GA4 送信完了イベントを接続する

検証: ブラウザから送信して D1 にレコードが入る／バリデーションエラーが項目ごとに表示される／キーを外すと Turnstile なしで送信できる

### T10 メール通知

作業:
1. `apps/api/src/mail/notify.ts`: Resend の薄ラッパー（`RESEND_API_KEY` 未設定なら何もしないで正常終了）
2. `POST /api/contact` の保存後に通知を呼ぶ。件名・本文は §1.5 のとおり。送信失敗はログのみで受付は成功扱いにする

検証: キー未設定で送信が成功する（保存のみ）／開発用のキーと送信先で実際にメールが届き、Reply-To が送信者のアドレスになっている

### T11 dashboard

作業:
1. `@repo/auth`: Cloudflare Access の JWT 検証ヘルパー（`jose` で JWKS を取得し、発行者 = `ACCESS_TEAM_DOMAIN`、対象 = `ACCESS_AUD` を検証）。dashboard のミドルウェアで全ページに適用する
2. `src/server/` に API クライアントを作成（サービストークンのヘッダーを付与。トークンはサーバー側の環境変数からのみ読む）
3. 管理 API（§1.5 の admin 系5エンドポイント）を apps/api に追加する
4. 画面を実装: 一覧（§1.6 の表・絞り込み・検索・ページング・CSV ボタン・未対応バッジ）と詳細（ステータス変更・管理メモ・論理削除）。更新操作は dashboard 自身のサーバーエンドポイント経由で API を叩く。UI 部品は shadcn/ui（テーブル・バッジ・セレクト・ダイアログ・トースト等、React island）を使い、ページの描画とデータ取得は Astro SSR のままにする（計画書 D5 改訂）

検証: Access の許可リスト外のアカウントでは入れない／一覧で絞り込み・検索・ページングが動く／ステータス変更とメモが API 経由で保存される／CSV が Excel で文字化けせず開ける／削除したレコードが一覧から消える

### T12 ドキュメント

作業:
1. README（日本語）: 概要、構成図、クイックスタート（clone → `bun install` → 環境変数 → マイグレーション → `bun run dev`）、機能一覧、ポリシー文面についての注意（雛形であり、そのまま使わず実態に合わせて修正すること）と kiyaku.jp への参照、ライセンス（MIT）
2. `docs/setup.md`: Cloudflare アカウント前提で、D1 作成、Workers へのデプロイ、Access の作成と許可リスト、サービストークン発行、Turnstile、Resend（SPF / DKIM のドメイン認証を含む）、GA4 の順に、実際の設定画面の項目名で手順を書く
3. `docs/customization.md`: サイト名・色、パッケージスコープ `@repo/*` の変更、フォーム項目の追加変更（§1.4 とプライバシーの同時修正を含む）、ポリシーの見直し方（kiyaku.jp 参照）、不要なポリシーページの外し方
4. `docs/deployment.md`: 環境変数マスター（§1.7）と、環境ごとのデプロイ手順

検証: T14 の再現テストの入力として使える状態にする（手順に未確定の分岐を残さない）

### T13 サンプル整備

作業:
1. フォームページのサンプル文面・固定ページ・site-config のダミー値が、実在の事業者・人物と誤認されない文面になっているか全点検する
2. 画像素材はダミーと分かるものだけを使う。`.env.example` を各アプリに用意し、実値は一切含めない

検証: 計画書 §10 チェックリストの「実データ混入」項目を通す

### T14 再現テスト

作業:
1. クリーンな環境（新しいクローン + 最小限の Cloudflare 設定）で、README と docs だけを頼りに 計画書 §12 の v0.1.0 定義（clone → dev → デプロイ → フォーム送信 → dashboard で確認）を通す
2. 詰まった箇所はすべて docs 側を直す（口頭前提を残さない）

検証: 手順が docs のみで完結する／所要手順に未記載の作業が残っていない

### T15 公開

作業:
1. 計画書 §10 の公開前チェックリストを全項目実施（LICENSE、実情報の除去、Template 設定を含む）
2. リポジトリ `engineer-ba-sulto/astro-site-dashboard-boilerplate` を公開し、GitHub の Template repository を有効化する。説明文と topics（計画書 §12）を設定する
3. v0.1.0 のタグとリリースノートを作成する

検証: チェックリストの未実施項目がゼロ／Template から新規リポジトリを作れる

### T16 デモ公開（v1.0 向け）

作業:
1. デモ用デプロイを本番用と分けて作成し、配布物の LP（apps/web）をデモとして公開する。api は `DEMO_MODE=true` で動かす。データはシードのダミーのみ
2. dashboard の一覧・詳細のスクリーンショットを撮り、README にデモ節（デモの URL とスクリーンショット）を追加する

検証: デモの LP が表示され、フォーム送信でレコードもメールも発生しない（デモモード）／README のリンクと画像が表示される

### T17 作成 CLI（後日導入、v0.1.0 対象外。EmDash の create-emdash 方式、計画書 D16）

作業:
1. `packages/create/` に CLI 本体を作る（package.json の name は `create-astro-site-dashboard-boilerplate`、bin を公開）。引数とフラグは §1.11 のとおり（`--template` / `--pm` / `--install` / `--no-install` / `--yes` / `--force` / `--help`）。未知のフラグは対話に落とさずエラーにする
2. 取得は giget でリポジトリ本体を取り寄せ、テンプレート差分（`lp` = 無変換、`form` = apps/web をフォーム一式のみに差し替え、`minimal` = apps/web の除外と関連スクリプト・docs の差し替え）を適用する。プロジェクト名の反映と `IP_HASH_SECRET` の生成（`.dev.vars`）まで §1.11 の生成手順どおりに行う
3. 生成直後の状態で `bun install` → `bun run dev` が通ることを、両テンプレートで確認する（T14 の再現テストの入力にする）
4. npm への公開手順（バージョンはリポジトリのリリースと揃える）を本チケットの作業に含める。導入時は README のクイックスタートを CLI 形式へ差し替え、T14 相当の生成再現テストを両テンプレートで行う

検証: `--template form` と `--template minimal` の生成物がそれぞれ dev 起動できる／`--yes` の無人実行が通る／空でないフォルダでは `--force` なしに上書きしない
