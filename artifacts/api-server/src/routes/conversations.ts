import { Router } from "express";
import { db } from "../lib/db";
import { conversationsTable, messagesTable, connectedPagesTable } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

type ConvRow = typeof conversationsTable.$inferSelect;
type MsgRow = typeof messagesTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

function toApiConversation(c: ConvRow, pageName?: string | null) {
  return {
    id: c.id,
    pageId: c.pageId,
    pageName: pageName ?? null,
    organizationId: c.organizationId,
    participantId: c.participantId,
    participantName: c.participantName,
    participantProfilePic: c.participantProfilePic ?? null,
    lastMessage: c.lastMessage ?? null,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    status: c.status,
    tags: c.tags ?? [],
    unreadCount: c.unreadCount,
    autoFollowupStep: c.autoFollowupStep,
    aiFollowupStep: c.aiFollowupStep,
    assignedTo: c.assignedTo ?? null,
    deletedAt: c.deletedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/conversations", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }

  const convs = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.organizationId, orgId), isNull(conversationsTable.deletedAt)));

  const pages = await db.select({ id: connectedPagesTable.id, pageName: connectedPagesTable.pageName }).from(connectedPagesTable);
  const pageMap = new Map(pages.map((p) => [p.id, p.pageName]));

  res.json(convs.map((c: ConvRow) => toApiConversation(c, pageMap.get(c.pageId) ?? null)));
});

router.get("/conversations/:id", requireAuth, async (req, res) => {
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, String(req.params.id))).limit(1);
  if (!conv) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiConversation(conv));
});

const convUpdateSchema = z.object({
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assignedTo: z.string().nullable().optional(),
});

router.patch("/conversations/:id", requireAuth, async (req, res) => {
  const parsed = convUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }
  const [conv] = await db.update(conversationsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(conversationsTable.id, String(req.params.id)))
    .returning();
  if (!conv) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiConversation(conv));
});

router.delete("/conversations/:id", requireAuth, async (req, res) => {
  await db.update(conversationsTable).set({ deletedAt: new Date() }).where(eq(conversationsTable.id, String(req.params.id)));
  res.status(204).send();
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────
function toApiMessage(m: MsgRow) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderType: m.senderType as "customer" | "page",
    content: m.content,
    mediaUrl: m.mediaUrl ?? null,
    messageType: m.messageType,
    isInternalNote: m.isInternalNote,
    isAiReply: m.isAiReply,
    sentBy: m.sentBy ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, String(req.params.conversationId)))
    .orderBy(messagesTable.createdAt);
  res.json(messages.map((m: MsgRow) => toApiMessage(m)));
});

const messageInputSchema = z.object({
  content: z.string(),
  mediaUrl: z.string().nullable().optional(),
  isInternalNote: z.boolean().optional(),
});

router.post("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }
  const parsed = messageInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const conversationId = String(req.params.conversationId);
  const [msg] = await db.insert(messagesTable).values({
    conversationId,
    organizationId: orgId,
    senderType: "page",
    sentBy: (req as any).user.id,
    content: parsed.data.content,
    mediaUrl: parsed.data.mediaUrl ?? null,
    isInternalNote: parsed.data.isInternalNote ?? false,
  }).returning();

  await db.update(conversationsTable)
    .set({ lastMessage: parsed.data.content, lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversationId));

  res.status(201).json(toApiMessage(msg));
});

export default router;
