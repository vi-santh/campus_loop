import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { listingsTable } from "./listings";
import { requestsTable } from "./requests";
import { usersTable } from "./users";

export const reuseTransactionsTable = pgTable(
  "reuse_transactions",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => listingsTable.id),
    requestId: integer("request_id").notNull().references(() => requestsTable.id),
    ownerId: integer("owner_id").notNull().references(() => usersTable.id),
    requesterId: integer("requester_id").notNull().references(() => usersTable.id),
    listingType: text("listing_type").notNull(),
    quantity: integer("quantity").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("reuse_transactions_request_idx").on(table.requestId)],
);

export const insertReuseTransactionSchema = createInsertSchema(reuseTransactionsTable).omit({
  id: true,
  completedAt: true,
});

export type InsertReuseTransaction = z.infer<typeof insertReuseTransactionSchema>;
export type ReuseTransaction = typeof reuseTransactionsTable.$inferSelect;