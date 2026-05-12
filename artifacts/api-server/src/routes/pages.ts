import { Router } from "express";
import { db } from "../lib/db";
import { connectedPagesTable, pageGroupsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

type PageRow = typeof connectedPagesTable.$inferSelect;
type GroupRow = typeof pageGroupsTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

function toApiPage(page: PageRow, groupName?: string | null) {
  return {
    id: page.id,
    pageId: page.pageId,
    pageName: page.pageName,
    pagePictureUrl: page.pagePictureUrl ?? null,
    connectionStatus: page.connectionStatus,
    organizationId: page.organizationId,
    groupId: page.groupId ?? null,
    groupName: groupName ?? null,
    aiEnabled: page.aiEnabled,
    automationEnabled: page.automationEnabled,
    aiInstructions: page.aiInstructions ?? null,
    aiDescription: page.aiDescription ?? null,
    productName: page.productName ?? null,
    productDescription: page.productDescription ?? null,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

// ─── PAGE GROUPS ────────────────────────────────────────────────────────────
router.get("/page-groups", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }
  const groups = await db.select().from(pageGroupsTable).where(eq(pageGroupsTable.organizationId, orgId));
  res.json(groups.map((g: GroupRow) => ({ id: g.id, name: g.name, organizationId: g.organizationId, createdAt: g.createdAt.toISOString() })));
});

router.post("/page-groups", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }
  const { name } = req.body as { name: string };
  const [group] = await db.insert(pageGroupsTable).values({ organizationId: orgId, name }).returning();
  res.status(201).json({ id: group.id, name: group.name, organizationId: group.organizationId, createdAt: group.createdAt.toISOString() });
});

router.delete("/page-groups/:id", requireAuth, async (req, res) => {
  await db.delete(pageGroupsTable).where(eq(pageGroupsTable.id, String(req.params.id)));
  res.status(204).send();
});

// ─── CONNECTED PAGES ─────────────────────────────────────────────────────────
router.get("/pages", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }

  const pages = await db.select().from(connectedPagesTable).where(eq(connectedPagesTable.organizationId, orgId));
  const groups = await db.select().from(pageGroupsTable).where(eq(pageGroupsTable.organizationId, orgId));
  const groupMap = new Map(groups.map((g: GroupRow) => [g.id, g.name]));

  res.json(pages.map((p: PageRow) => toApiPage(p, p.groupId ? (groupMap.get(p.groupId) ?? null) : null)));
});

const pageInputSchema = z.object({
  pageId: z.string(),
  pageName: z.string(),
  pageAccessToken: z.string(),
  pagePictureUrl: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
});

router.post("/pages", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }
  const parsed = pageInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [page] = await db.insert(connectedPagesTable).values({
    organizationId: orgId,
    connectedBy: (req as any).user.id,
    pageId: parsed.data.pageId,
    pageName: parsed.data.pageName,
    pageAccessToken: parsed.data.pageAccessToken,
    pagePictureUrl: parsed.data.pagePictureUrl ?? null,
    groupId: parsed.data.groupId ?? null,
  }).returning();
  res.status(201).json(toApiPage(page));
});

router.get("/pages/:id", requireAuth, async (req, res) => {
  const [page] = await db.select().from(connectedPagesTable).where(eq(connectedPagesTable.id, String(req.params.id))).limit(1);
  if (!page) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiPage(page));
});

const pageUpdateSchema = z.object({
  pageName: z.string().optional(),
  connectionStatus: z.string().optional(),
  groupId: z.string().nullable().optional(),
  aiEnabled: z.boolean().optional(),
  automationEnabled: z.boolean().optional(),
  aiInstructions: z.string().nullable().optional(),
  aiDescription: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  productDescription: z.string().nullable().optional(),
});

router.patch("/pages/:id", requireAuth, async (req, res) => {
  const parsed = pageUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }
  const [page] = await db.update(connectedPagesTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(connectedPagesTable.id, String(req.params.id))).returning();
  if (!page) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiPage(page));
});

router.delete("/pages/:id", requireAuth, async (req, res) => {
  await db.delete(connectedPagesTable).where(eq(connectedPagesTable.id, String(req.params.id)));
  res.status(204).send();
});

export default router;
