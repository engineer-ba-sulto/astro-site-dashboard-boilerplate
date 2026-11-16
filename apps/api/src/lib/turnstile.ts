export async function verifyTurnstile(options: {
  secret: string | undefined;
  token: string | undefined;
  remoteIp: string;
}): Promise<"skipped" | "ok" | "failed"> {
  if (!options.secret) return "skipped";
  if (!options.token) return "failed";
  const body = new URLSearchParams();
  body.set("secret", options.secret);
  body.set("response", options.token);
  body.set("remoteip", options.remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!response.ok) return "failed";
  const payload = (await response.json()) as { success?: boolean };
  return payload.success ? "ok" : "failed";
}
