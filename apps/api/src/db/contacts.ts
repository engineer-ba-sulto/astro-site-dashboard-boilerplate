import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import type { Database } from "./client";
import { contacts } from "./schema";

export type ContactRow = typeof contacts.$inferSelect;

export type NewContact = {
  name: string | null;
  email: string;
  category: string | null;
  message: string;
  ipHash: string;
  userAgent: string | null;
  createdAt: number;
};

export type ListFilter = {
  status?: "new" | "in_progress" | "done" | "spam" | undefined;
  q?: string | undefined;
  page: number;
  perPage: number;
};

function searchClause(q: string | undefined) {
  if (!q) return undefined;
  const pattern = `%${q.replaceAll("%", "").replaceAll("_", "")}%`;
  return or(
    like(contacts.name, pattern),
    like(contacts.email, pattern),
    like(contacts.message, pattern),
  );
}

function listWhere(filter: Pick<ListFilter, "status" | "q">) {
  return and(
    isNull(contacts.deletedAt),
    filter.status ? eq(contacts.status, filter.status) : undefined,
    searchClause(filter.q),
  );
}

export async function countRecentByIp(db: Database, ipHash: string, sinceUnix: number) {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(contacts)
    .where(and(eq(contacts.ipHash, ipHash), sql`${contacts.createdAt} >= ${sinceUnix}`));
  return Number(rows[0]?.total ?? 0);
}

export async function insertContact(db: Database, input: NewContact) {
  const inserted = await db
    .insert(contacts)
    .values({
      name: input.name,
      email: input.email,
      category: input.category,
      message: input.message,
      status: "new",
      ipHash: input.ipHash,
      userAgent: input.userAgent,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
    .returning({ id: contacts.id });
  const id = inserted[0]?.id;
  if (id === undefined) throw new Error("insert did not return an id");
  return id;
}

export async function listContacts(db: Database, filter: ListFilter) {
  const where = listWhere(filter);
  const totalRows = await db.select({ total: sql<number>`count(*)` }).from(contacts).where(where);
  const items = await db
    .select()
    .from(contacts)
    .where(where)
    .orderBy(desc(contacts.createdAt))
    .limit(filter.perPage)
    .offset((filter.page - 1) * filter.perPage);
  return { items, total: Number(totalRows[0]?.total ?? 0) };
}

export async function countByStatus(db: Database, status: "new" | "in_progress" | "done" | "spam") {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(contacts)
    .where(and(isNull(contacts.deletedAt), eq(contacts.status, status)));
  return Number(rows[0]?.total ?? 0);
}

export async function getContact(db: Database, id: number) {
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateContact(
  db: Database,
  id: number,
  patch: { status?: string | undefined; adminNote?: string | null | undefined; updatedAt: number },
) {
  const set: { updatedAt: number; status?: string; adminNote?: string | null } = {
    updatedAt: patch.updatedAt,
  };
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.adminNote !== undefined) set.adminNote = patch.adminNote;
  const rows = await db
    .update(contacts)
    .set(set)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .returning();
  return rows[0] ?? null;
}

export async function softDeleteContact(db: Database, id: number, deletedAt: number) {
  const rows = await db
    .update(contacts)
    .set({ deletedAt, updatedAt: deletedAt })
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .returning({ id: contacts.id });
  return rows[0]?.id ?? null;
}

export async function listContactsForExport(
  db: Database,
  filter: Pick<ListFilter, "status" | "q">,
  limit: number,
) {
  return db
    .select()
    .from(contacts)
    .where(listWhere(filter))
    .orderBy(desc(contacts.createdAt))
    .limit(limit);
}
