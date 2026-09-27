import { createInsertSchema } from "drizzle-zod";
import {
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { usersTable } from "./users";

export const listingsTable = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
    condition: text("condition").notNull(),
    quantity: integer("quantity").notNull(),
    availableQuantity: integer("available_quantity").notNull(),
    location: text("location").notNull(),
    ownerId: integer("owner_id").notNull().references(() => usersTable.id),
    imageUrl: text("image_url"),
    tags: text("tags").array().notNull().default([]),
    department: text("department").notNull(),
    listingType: text("listing_type").notNull(),
    status: text("status").notNull().default("AVAILABLE"),
    expiryDate: date("expiry_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("listings_owner_idx").on(table.ownerId),
    index("listings_category_idx").on(table.categoryId),
    index("listings_status_idx").on(table.status),
    index("listings_created_idx").on(table.createdAt),
  ],
);

export const insertListingSchema = createInsertSchema(listingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;