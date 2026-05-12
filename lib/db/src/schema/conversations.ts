import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { connectedPagesTable } from "./pages";

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  pageId: text("page_id").notNull().references(() => connectedPagesTable.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  participantName: text("participant_name").notNull(),
  participantProfilePic: text("participant_profile_pic"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  tags: text("tags").array().notNull().default([]),
  unreadCount: integer("unread_count").notNull().default(0),
  autoFollowupStep: integer("auto_followup_step").notNull().default(0),
  aiFollowupStep: integer("ai_followup_step").notNull().default(0),
  assignedTo: text("assigned_to"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull().default("customer"),
  content: text("content").notNull().default(""),
  mediaUrl: text("media_url"),
  messageType: text("message_type").notNull().default("text"),
  isInternalNote: boolean("is_internal_note").notNull().default(false),
  isAiReply: boolean("is_ai_reply").notNull().default(false),
  sentBy: text("sent_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
