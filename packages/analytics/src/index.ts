/**
 * GA4 に送ってよいイベントだけを型で固定する。
 * フォームの入力内容・メールアドレスなどの個人情報はパラメータに含めない。
 */
export const analyticsEvents = {
  contactSubmit: "contact_submit",
} as const;

export type AnalyticsEventName = (typeof analyticsEvents)[keyof typeof analyticsEvents];

export type ContactSubmitParams = {
  category?: "general" | "work" | "other";
};

type Gtag = (command: "event", name: AnalyticsEventName, params?: ContactSubmitParams) => void;

function readGtag(): Gtag | undefined {
  const candidate = (globalThis as { gtag?: Gtag }).gtag;
  return typeof candidate === "function" ? candidate : undefined;
}

/** 送信完了時に呼ぶ。gtag が無い（計測 ID 未設定）ときは何もしない。 */
export function trackContactSubmit(params: ContactSubmitParams = {}): void {
  const gtag = readGtag();
  if (!gtag) return;
  const payload: ContactSubmitParams = {};
  if (params.category) payload.category = params.category;
  gtag("event", analyticsEvents.contactSubmit, payload);
}
