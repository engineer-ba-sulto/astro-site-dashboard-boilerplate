import { and, eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import { contactAttempts } from "./schema";

export async function countRecentAttempts(db: Database, ipHash: string, sinceUnix: number) {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(contactAttempts)
    .where(
      and(eq(contactAttempts.ipHash, ipHash), sql`${contactAttempts.createdAt} >= ${sinceUnix}`),
    );
  return Number(rows[0]?.total ?? 0);
}

export async function insertAttempt(db: Database, ipHash: string, createdAt: number) {
  await db.insert(contactAttempts).values({ ipHash, createdAt });
}
