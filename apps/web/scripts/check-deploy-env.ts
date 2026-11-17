/**
 * 本番デプロイ前に、ローカル用 .env がビルドへ混ざらないようにする。
 * Vite は import.meta.env に .env の値を読むため、.env に localhost が残っていると
 * シェルで渡した PUBLIC_* より優先されることがある（setup.md §3 web を参照）。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "../.env");
if (!existsSync(envPath)) {
  process.exit(0);
}

const content = readFileSync(envPath, "utf8");
const hasLocalhostPublicUrl = /^PUBLIC_(SITE_URL|API_BASE_URL)\s*=\s*\S*localhost/im.test(content);

if (hasLocalhostPublicUrl) {
  console.error(
    [
      "apps/web/.env に localhost の PUBLIC_SITE_URL または PUBLIC_API_BASE_URL が残っています。",
      "本番ビルドのあいだだけ .env を退避してから deploy してください（docs/setup.md の「3. Worker をデプロイする」→ web）。",
      "ローカル開発用に戻すときは、deploy のあと .env を元に戻します。",
    ].join("\n"),
  );
  process.exit(1);
}
