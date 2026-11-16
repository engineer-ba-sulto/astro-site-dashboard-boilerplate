import { labelForCategory } from "@repo/contact-form";
import { siteConfig } from "@repo/site-config";
import { Resend } from "resend";

export type NotifyInput = {
  id: number;
  name: string | null;
  email: string;
  category: string | null;
  message: string;
  dashboardBaseUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function notifyNewContact(
  env: {
    RESEND_API_KEY?: string | undefined;
    CONTACT_NOTIFY_TO?: string | undefined;
    CONTACT_FROM?: string | undefined;
  },
  input: NotifyInput,
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.CONTACT_NOTIFY_TO || !env.CONTACT_FROM) return;
  const categoryLabel = labelForCategory(input.category);
  const subject = `[${siteConfig.name}] 新しいお問い合わせ（${categoryLabel}）`;
  const detailUrl = `${input.dashboardBaseUrl.replace(/\/$/, "")}/contacts/${input.id}/`;
  const name = input.name ?? "（名前なし）";
  const text = [
    `${siteConfig.name} に新しいお問い合わせが届きました。`,
    "",
    `名前: ${name}`,
    `メールアドレス: ${input.email}`,
    `種類: ${categoryLabel}`,
    "本文:",
    input.message,
    "",
    `管理画面: ${detailUrl}`,
  ].join("\n");
  const html = `<p>${escapeHtml(siteConfig.name)} に新しいお問い合わせが届きました。</p>
<ul>
<li>名前: ${escapeHtml(name)}</li>
<li>メールアドレス: ${escapeHtml(input.email)}</li>
<li>種類: ${escapeHtml(categoryLabel)}</li>
</ul>
<pre>${escapeHtml(input.message)}</pre>
<p><a href="${escapeHtml(detailUrl)}">管理画面で開く</a></p>`;
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.CONTACT_FROM,
      to: env.CONTACT_NOTIFY_TO,
      subject,
      text,
      html,
      replyTo: input.email,
    });
    if (error) {
      console.error(
        JSON.stringify({ event: "contact_notify_failed", id: input.id, message: error.message }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "contact_notify_failed",
        id: input.id,
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}
