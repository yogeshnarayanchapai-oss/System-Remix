import { Router } from "express";
import { db } from "../lib/db";
import { messagesTable, leadsTable } from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

type MsgRow = typeof messagesTable.$inferSelect;
type LeadRow = typeof leadsTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

router.get("/reports/data", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  const period = String(req.query.period ?? "7d");
  const days = period === "30d" ? 30 : 7;

  const from = new Date();
  from.setDate(from.getDate() - days);

  if (!orgId) {
    const chartData = Array.from({ length: days }, (_, i) => {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), messages: 0, replies: 0 };
    });
    res.json({ totalMessages: 0, leadsCreated: 0, chartData, leadFunnel: [] });
    return;
  }

  const allMsgs = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.organizationId, orgId), gte(messagesTable.createdAt, from)));

  const allLeads = await db.select().from(leadsTable)
    .where(and(eq(leadsTable.organizationId, orgId), gte(leadsTable.createdAt, from)));

  const chartData = Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const dayStr = d.toDateString();
    const dayMsgs = allMsgs.filter((m: MsgRow) => new Date(m.createdAt).toDateString() === dayStr);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      messages: dayMsgs.filter((m: MsgRow) => m.senderType === "customer").length,
      replies: dayMsgs.filter((m: MsgRow) => m.senderType === "page").length,
    };
  });

  const leadFunnel = [
    { name: "New", value: allLeads.filter((l: LeadRow) => l.status === "new").length },
    { name: "Pulled", value: allLeads.filter((l: LeadRow) => l.status === "pulled").length },
    { name: "Hot", value: allLeads.filter((l: LeadRow) => l.status === "hot").length },
    { name: "Follow Up", value: allLeads.filter((l: LeadRow) => l.status === "follow_up").length },
    { name: "Closed", value: allLeads.filter((l: LeadRow) => l.status === "closed").length },
  ];

  res.json({
    totalMessages: allMsgs.filter((m: MsgRow) => m.senderType === "customer").length,
    leadsCreated: allLeads.length,
    chartData,
    leadFunnel,
  });
});

export default router;
