import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** デモモードの受付回数。問い合わせ本文は置かず、上限の計算にだけ使う。 */
export const contactAttempts = sqliteTable("contact_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ipHash: text("ip_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const contacts = sqliteTable(
  "contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name"),
    email: text("email").notNull(),
    category: text("category"),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    adminNote: text("admin_note"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (table) => [
    index("contacts_status_created_at_idx").on(table.status, table.createdAt),
    index("contacts_created_at_idx").on(table.createdAt),
    index("contacts_ip_hash_created_at_idx").on(table.ipHash, table.createdAt),
  ],
);
