import { Router } from "express";
import { db } from "../lib/db";
import { automationRulesTable, replyTemplatesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

type RuleRow = typeof automationRulesTable.$inferSelect;
type TemplateRow = typeof replyTemplatesTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

function toApiRule(r: RuleRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    triggerType: r.triggerType,
    isActive: r.isActive,
    autoSend: r.autoSend,
    pageId: r.pageId ?? null,
    organizationId: r.organizationId ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toApiTemplate(t: TemplateRow) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    content: t.content,
    isActive: t.isActive,
    organizationId: t.organizationId ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// ─── RULES ───────────────────────────────────────────────────────────────────
router.get("/automation/rules", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }
  const rules = await db.select().from(automationRulesTable).where(eq(automationRulesTable.organizationId, orgId));
  res.json(rules.map((r: RuleRow) => toApiRule(r)));
});

const ruleInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  triggerType: z.string(),
  autoSend: z.boolean().optional(),
  pageId: z.string().nullable().optional(),
});

router.post("/automation/rules", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }
  const parsed = ruleInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [rule] = await db.insert(automationRulesTable).values({
    organizationId: orgId,
    createdBy: (req as any).user.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    triggerType: parsed.data.triggerType,
    autoSend: parsed.data.autoSend ?? false,
    pageId: parsed.data.pageId ?? null,
  }).returning();
  res.status(201).json(toApiRule(rule));
});

const ruleUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  triggerType: z.string().optional(),
  isActive: z.boolean().optional(),
  autoSend: z.boolean().optional(),
});

router.patch("/automation/rules/:id", requireAuth, async (req, res) => {
  const parsed = ruleUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }
  const [rule] = await db.update(automationRulesTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(automationRulesTable.id, String(req.params.id))).returning();
  if (!rule) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiRule(rule));
});

router.delete("/automation/rules/:id", requireAuth, async (req, res) => {
  await db.delete(automationRulesTable).where(eq(automationRulesTable.id, String(req.params.id)));
  res.status(204).send();
});

router.post("/automation/rules/:id/toggle", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(automationRulesTable).where(eq(automationRulesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Not found" }); return; }
  const [rule] = await db.update(automationRulesTable).set({ isActive: !existing.isActive, updatedAt: new Date() }).where(eq(automationRulesTable.id, id)).returning();
  res.json(toApiRule(rule));
});

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
router.get("/automation/templates", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }
  const templates = await db.select().from(replyTemplatesTable).where(eq(replyTemplatesTable.organizationId, orgId));
  res.json(templates.map((t: TemplateRow) => toApiTemplate(t)));
});

const templateInputSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  content: z.string(),
});

router.post("/automation/templates", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }
  const parsed = templateInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [template] = await db.insert(replyTemplatesTable).values({
    organizationId: orgId,
    createdBy: (req as any).user.id,
    name: parsed.data.name,
    category: parsed.data.category ?? "general",
    content: parsed.data.content,
  }).returning();
  res.status(201).json(toApiTemplate(template));
});

const templateUpdateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  content: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.patch("/automation/templates/:id", requireAuth, async (req, res) => {
  const parsed = templateUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }
  const [template] = await db.update(replyTemplatesTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(replyTemplatesTable.id, String(req.params.id))).returning();
  if (!template) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiTemplate(template));
});

router.delete("/automation/templates/:id", requireAuth, async (req, res) => {
  await db.delete(replyTemplatesTable).where(eq(replyTemplatesTable.id, String(req.params.id)));
  res.status(204).send();
});

router.post("/automation/templates/:id/toggle", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(replyTemplatesTable).where(eq(replyTemplatesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Not found" }); return; }
  const [template] = await db.update(replyTemplatesTable).set({ isActive: !existing.isActive, updatedAt: new Date() }).where(eq(replyTemplatesTable.id, id)).returning();
  res.json(toApiTemplate(template));
});

export default router;
