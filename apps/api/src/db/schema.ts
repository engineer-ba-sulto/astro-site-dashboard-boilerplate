import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  ],
);
