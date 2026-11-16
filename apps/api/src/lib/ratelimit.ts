export const RATE_LIMIT_MAX = 5;
/** 仕様は 10 分に 5 回。バインディングの period は 10 か 60 秒だけなので、10 分窓は D1 の件数で見る。 */
export const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

export type RateLimiterBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export async function bindingAllows(limiter: RateLimiterBinding, key: string): Promise<boolean> {
  const result = await limiter.limit({ key });
  return result.success;
}
