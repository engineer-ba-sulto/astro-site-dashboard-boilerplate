export async function hashIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
}

/**
 * レート制限に使う送信元の単位。
 * IPv4 はそのアドレス、IPv6 は /64（後ろ 64 ビットの端末番号は捨てる）。
 * ハッシュの入力に `/64` を含め、アドレスそのものと同じ文字列にならないようにする。
 * 解釈できない値は、そのまま 1 つの枠にする。
 */
export function rateLimitSubject(ip: string): string {
  const trimmed = ip.trim();
  const unbracketed =
    trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  const withoutZone = unbracketed.split("%", 1)[0] ?? unbracketed;
  const ipv4 = parseIpv4(withoutZone);
  if (ipv4) return ipv4;
  const groups = parseIpv6(withoutZone);
  if (!groups) return trimmed;
  const mapped = ipv4FromMapped(groups);
  if (mapped) return mapped;
  const prefix = groups.map((group, index) => (index < 4 ? group : 0));
  return `${formatIpv6(prefix)}/64`;
}

function parseIpv4(value: string): string | null {
  const octets = ipv4Octets(value);
  return octets ? octets.join(".") : null;
}

function ipv4Octets(value: string): [number, number, number, number] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets: [number, number, number, number] = [0, 0, 0, 0];
  for (let index = 0; index < 4; index += 1) {
    const part = parts[index];
    if (part === undefined || !/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets[index] = octet;
  }
  return octets;
}

function parseIpv6(value: string): number[] | null {
  const embedded = embedIpv4(value.toLowerCase());
  if (embedded === null) return null;
  if (!embedded.includes(":") || embedded.includes(":::")) return null;
  if (embedded.indexOf("::") !== embedded.lastIndexOf("::")) return null;
  if (!embedded.includes("::")) {
    const groups = splitGroups(embedded);
    return groups?.length === 8 ? groups : null;
  }
  const [leftRaw, rightRaw] = embedded.split("::");
  const left = splitGroups(leftRaw ?? "");
  const right = splitGroups(rightRaw ?? "");
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array<number>(missing).fill(0), ...right];
}

function embedIpv4(value: string): string | null {
  if (!value.includes(".")) return value;
  const lastColon = value.lastIndexOf(":");
  if (lastColon < 0) return null;
  const octets = ipv4Octets(value.slice(lastColon + 1));
  if (!octets) return null;
  const [a, b, c, d] = octets;
  const high = ((a << 8) | b).toString(16);
  const low = ((c << 8) | d).toString(16);
  return `${value.slice(0, lastColon + 1)}${high}:${low}`;
}

function splitGroups(value: string): number[] | null {
  if (value === "") return [];
  const groups: number[] = [];
  for (const part of value.split(":")) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    groups.push(Number.parseInt(part, 16));
  }
  return groups;
}

function ipv4FromMapped(groups: number[]): string | null {
  const mapped =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff;
  if (!mapped) return null;
  const high = groups[6] ?? 0;
  const low = groups[7] ?? 0;
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function formatIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLength = 0;
  let index = 0;
  while (index < groups.length) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < groups.length && groups[index] === 0) index += 1;
    const length = index - start;
    if (length > bestLength) {
      bestStart = start;
      bestLength = length;
    }
  }
  if (bestLength < 2) return groups.map((group) => group.toString(16)).join(":");
  const left = groups.slice(0, bestStart).map((group) => group.toString(16));
  const right = groups.slice(bestStart + bestLength).map((group) => group.toString(16));
  return `${left.join(":")}::${right.join(":")}`;
}
