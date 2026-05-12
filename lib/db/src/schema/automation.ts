import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const automationRulesTable = pgTable("automation_rules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  pageId: text("page_id"),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  autoSend: boolean("auto_send").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const replyTemplatesTable = pgTable("reply_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const appSettingsTable = pgTable("app_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  facebookAppId: text("facebook_app_id"),
  facebookAppSecret: text("facebook_app_secret"),
  facebookWebhookToken: text("facebook_webhook_token"),
  aiTone: text("ai_tone").default("professional"),
  aiModel: text("ai_model").default("gpt-4o-mini"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAutomationRuleSchema = createInsertSchema(automationRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReplyTemplateSchema = createInsertSchema(replyTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({ id: true, updatedAt: true });
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type InsertReplyTemplate = z.infer<typeof insertReplyTemplateSchema>;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AutomationRule = typeof automationRulesTable.$inferSelect;
export type ReplyTemplate = typeof replyTemplatesTable.$inferSelect;
export type AppSettings = typeof appSettingsTable.$inferSelect;
