import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { listingsTable } from "./listings";
import { usersTable } from "./users";

export const requestsTable = pgTable(
  "requests",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => listingsTable.id),
    requesterId: integer("requester_id").notNull().references(() => usersTable.id),
    ownerId: integer("owner_id").notNull().references(() => usersTable.id),
    message: text("message").notNull(),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("requests_listing_idx").on(table.listingId),
    index("requests_requester_idx").on(table.requesterId),
    index("requests_owner_idx").on(table.ownerId),
    index("requests_status_idx").on(table.status),
  ],
);

export const insertRequestSchema = createInsertSchema(requestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type ItemRequest = typeof requestsTable.$inferSelect;