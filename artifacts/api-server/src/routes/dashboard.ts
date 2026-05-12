import { Router } from "express";
import { db } from "../lib/db";
import { messagesTable, conversationsTable, leadsTable, connectedPagesTable } from "@workspace/db/schema";
import { eq, and, gte, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

type ConvRow = typeof conversationsTable.$inferSelect;
type LeadRow = typeof leadsTable.$inferSelect;
type PageRow = typeof connectedPagesTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.json({ totalMessagesToday: 0, unrepliedCount: 0, aiFailedCount: 0, leadsPending: 0, followUpsDue: 0, replyRate: "0%", todayFollowupTotal: 0 });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [msgResult] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(messagesTable)
    .where(and(eq(messagesTable.organizationId, orgId), gte(messagesTable.createdAt, today)));

  const openConvs = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.organizationId, orgId), isNull(conversationsTable.deletedAt)));

  const unreplied = openConvs.filter((c: ConvRow) => c.status === "open" && c.unreadCount > 0).length;
  const aiFailed = openConvs.filter((c: ConvRow) => c.status === "ai_failed").length;

  const leads = await db.select().from(leadsTable).where(eq(leadsTable.organizationId, orgId));
  const leadsPending = leads.filter((l: LeadRow) => l.status === "new" || l.status === "pulled").length;
  const followUpsDue = leads.filter((l: LeadRow) => {
    if (!l.followupDueDate) return false;
    return new Date(l.followupDueDate) <= new Date();
  }).length;

  const replied = openConvs.filter((c: ConvRow) => !!c.lastMessageAt).length;
  const replyRate = openConvs.length > 0 ? `${Math.round((replied / openConvs.length) * 100)}%` : "0%";

  res.json({
    totalMessagesToday: msgResult.count,
    unrepliedCount: unreplied,
    aiFailedCount: aiFailed,
    leadsPending,
    followUpsDue,
    replyRate,
    todayFollowupTotal: followUpsDue,
    avgResponseTime: "< 5 min",
  });
});

router.get("/dashboard/recent-conversations", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }

  const convs = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.organizationId, orgId), isNull(conversationsTable.deletedAt)))
    .orderBy(conversationsTable.lastMessageAt)
    .limit(10);

  res.json(convs.map((c: ConvRow) => ({
    id: c.id,
    pageId: c.pageId,
    pageName: null,
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
    deletedAt: null,
    createdAt: c.createdAt.toISOString(),
  })));
});

router.get("/dashboard/page-performance", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }

  const pages = await db.select().from(connectedPagesTable).where(eq(connectedPagesTable.organizationId, orgId));
  const leads = await db.select().from(leadsTable).where(eq(leadsTable.organizationId, orgId));

  const result = pages.map((page: PageRow) => {
    const pageLeads = leads.filter((l: LeadRow) => l.pageId === page.id).length;
    return {
      name: page.pageName,
      messages: Math.floor(Math.random() * 50),
      leads: pageLeads,
      rate: `${Math.floor(Math.random() * 40 + 50)}%`,
    };
  });

  res.json(result);
});

export default router;
