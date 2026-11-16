function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export function requireServiceToken(input: {
  providedId: string | undefined;
  providedSecret: string | undefined;
  expectedId: string | undefined;
  expectedSecret: string | undefined;
}): boolean {
  return serviceTokenMatches(
    input.providedId,
    input.providedSecret,
    input.expectedId,
    input.expectedSecret,
  );
}

export function serviceTokenMatches(
  providedId: string | undefined,
  providedSecret: string | undefined,
  expectedId: string | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedId || !expectedSecret || !providedId || !providedSecret) return false;
  return safeEqual(providedId, expectedId) && safeEqual(providedSecret, expectedSecret);
}
