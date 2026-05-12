import { Router } from "express";
import { db } from "../lib/db";
import { leadsTable, connectedPagesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

type LeadRow = typeof leadsTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

function toApiLead(lead: LeadRow, pageName?: string | null) {
  return {
    id: lead.id,
    fullName: lead.fullName,
    phone: lead.phone ?? null,
    status: lead.status as "new" | "pulled" | "hot" | "follow_up" | "closed",
    pageId: lead.pageId ?? null,
    pageName: pageName ?? null,
    organizationId: lead.organizationId,
    conversationId: lead.conversationId ?? null,
    product: lead.product ?? null,
    notes: lead.notes ?? null,
    followupDueDate: lead.followupDueDate?.toISOString() ?? null,
    assignedTo: lead.assignedTo ?? null,
    createdBy: lead.createdBy ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

router.get("/leads", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }

  const leads = await db.select().from(leadsTable).where(eq(leadsTable.organizationId, orgId)).orderBy(leadsTable.createdAt);
  const pages = await db.select({ id: connectedPagesTable.id, pageName: connectedPagesTable.pageName }).from(connectedPagesTable);
  const pageMap = new Map(pages.map((p) => [p.id, p.pageName]));

  res.json(leads.map((l: LeadRow) => toApiLead(l, l.pageId ? (pageMap.get(l.pageId) ?? null) : null)));
});

router.get("/leads/stats", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json({ total: 0, new: 0, hot: 0, follow_up: 0, closed: 0 }); return; }

  const all = await db.select().from(leadsTable).where(eq(leadsTable.organizationId, orgId));
  res.json({
    total: all.length,
    new: all.filter((l: LeadRow) => l.status === "new").length,
    hot: all.filter((l: LeadRow) => l.status === "hot").length,
    follow_up: all.filter((l: LeadRow) => l.status === "follow_up").length,
    closed: all.filter((l: LeadRow) => l.status === "closed").length,
  });
});

const leadInputSchema = z.object({
  fullName: z.string(),
  phone: z.string().nullable().optional(),
  pageId: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
});

router.post("/leads", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }
  const parsed = leadInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [lead] = await db.insert(leadsTable).values({
    organizationId: orgId,
    createdBy: (req as any).user.id,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    pageId: parsed.data.pageId ?? null,
    product: parsed.data.product ?? null,
    notes: parsed.data.notes ?? null,
    status: parsed.data.status ?? "new",
  }).returning();
  res.status(201).json(toApiLead(lead));
});

router.get("/leads/:id", requireAuth, async (req, res) => {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, String(req.params.id))).limit(1);
  if (!lead) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiLead(lead));
});

const leadUpdateSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().nullable().optional(),
  status: z.string().optional(),
  product: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  followupDueDate: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

router.patch("/leads/:id", requireAuth, async (req, res) => {
  const parsed = leadUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.followupDueDate !== undefined) {
    updateData.followupDueDate = parsed.data.followupDueDate ? new Date(parsed.data.followupDueDate) : null;
  }

  const [lead] = await db.update(leadsTable).set(updateData as Parameters<typeof db.update>[0] extends infer T ? any : any).where(eq(leadsTable.id, String(req.params.id))).returning();
  if (!lead) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiLead(lead));
});

router.delete("/leads/:id", requireAuth, async (req, res) => {
  await db.delete(leadsTable).where(eq(leadsTable.id, String(req.params.id)));
  res.status(204).send();
});

export default router;
