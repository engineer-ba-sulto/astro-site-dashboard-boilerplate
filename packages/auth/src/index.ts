import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

export type AccessJwtOptions = {
  /** 例: `example.cloudflareaccess.com`（スキームなし） */
  teamDomain: string;
  /** Access アプリケーションの AUD タグ */
  audience: string;
};

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizeTeamDomain(teamDomain: string): string {
  return teamDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function verifyAccessJwt(
  token: string,
  options: AccessJwtOptions,
): Promise<JWTPayload> {
  const issuer = `https://${normalizeTeamDomain(options.teamDomain)}`;
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByIssuer.set(issuer, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: options.audience,
  });
  return payload;
}

export function readAccessEmail(payload: JWTPayload): string | undefined {
  return typeof payload.email === "string" ? payload.email : undefined;
}
