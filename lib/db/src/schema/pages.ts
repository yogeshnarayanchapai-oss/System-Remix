import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const pageGroupsTable = pgTable("page_groups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connectedPagesTable = pgTable("connected_pages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  pageId: text("page_id").notNull(),
  pageName: text("page_name").notNull(),
  pagePictureUrl: text("page_picture_url"),
  pageAccessToken: text("page_access_token").notNull(),
  connectionStatus: text("connection_status").notNull().default("active"),
  groupId: text("group_id").references(() => pageGroupsTable.id, { onDelete: "set null" }),
  connectedBy: text("connected_by"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  aiInstructions: text("ai_instructions"),
  aiDescription: text("ai_description"),
  productName: text("product_name"),
  productDescription: text("product_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPageGroupSchema = createInsertSchema(pageGroupsTable).omit({ id: true, createdAt: true });
export const insertConnectedPageSchema = createInsertSchema(connectedPagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPageGroup = z.infer<typeof insertPageGroupSchema>;
export type InsertConnectedPage = z.infer<typeof insertConnectedPageSchema>;
export type PageGroup = typeof pageGroupsTable.$inferSelect;
export type ConnectedPage = typeof connectedPagesTable.$inferSelect;
