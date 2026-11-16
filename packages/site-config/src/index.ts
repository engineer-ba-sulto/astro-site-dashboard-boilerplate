/**
 * サイトの差し替え箇所。値はすべて架空のサンプルです。
 * 環境変数で上書きできるのは URL（PUBLIC_SITE_URL）だけです。
 */
export const siteConfig = {
  name: "あおぞら工務店",
  /** name がこの文字列で終わるとき、ヘッダーのその部分だけ色を変える */
  nameAccent: "工務店",
  description:
    "（サンプル文）水まわりの小さな修繕から、間取りを変えるリフォームまで。地域密着で、見積もりは無料です。",
  url: "http://localhost:4321",
  email: "privacy@example.com",
  operatorName: "あおぞら工務店（架空のサンプル事業者です）",
  phone: "000-0000-0000",
  phoneHours: "平日 9:00–17:00",
  address: "〒000-0000 サンプル県サンプル市中央1-2-3",
  business: "住宅リフォーム、水まわり工事、バリアフリー改修、小さな修繕",
  area: "サンプル市とその近郊（車で45分以内）",
} as const;

export type SiteConfig = {
  [Key in keyof typeof siteConfig]: string;
};

const defaultUrl = "http://localhost:4321";

/** PUBLIC_SITE_URL が空なら localhost に戻す。末尾のスラッシュは除く。 */
export function resolveSiteConfig(publicSiteUrl?: string | undefined): SiteConfig {
  const trimmed = publicSiteUrl?.trim();
  const url = trimmed ? trimmed.replace(/\/$/, "") : defaultUrl;
  return { ...siteConfig, url };
}
