import { Router } from "express";
import { db } from "../lib/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

type SettingsRow = typeof appSettingsTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

function toApiSettings(s: SettingsRow) {
  return {
    organizationId: s.organizationId ?? null,
    facebookAppId: s.facebookAppId ?? null,
    facebookAppSecret: s.facebookAppSecret ?? null,
    facebookWebhookToken: s.facebookWebhookToken ?? null,
    aiTone: s.aiTone ?? null,
    aiModel: s.aiModel ?? null,
    notificationsEnabled: s.notificationsEnabled,
  };
}

router.get("/settings", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.json({ organizationId: null, facebookAppId: null, facebookAppSecret: null, facebookWebhookToken: null, aiTone: null, aiModel: null, notificationsEnabled: true });
    return;
  }

  const [settings] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.organizationId, orgId)).limit(1);
  if (!settings) {
    const [created] = await db.insert(appSettingsTable).values({ organizationId: orgId }).returning();
    res.json(toApiSettings(created));
    return;
  }
  res.json(toApiSettings(settings));
});

const settingsUpdateSchema = z.object({
  facebookAppId: z.string().nullable().optional(),
  facebookAppSecret: z.string().nullable().optional(),
  facebookWebhookToken: z.string().nullable().optional(),
  aiTone: z.string().nullable().optional(),
  aiModel: z.string().nullable().optional(),
  notificationsEnabled: z.boolean().optional(),
});

router.patch("/settings", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }

  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [existing] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.organizationId, orgId)).limit(1);
  let settings: SettingsRow;
  if (existing) {
    [settings] = await db.update(appSettingsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(appSettingsTable.organizationId, orgId)).returning();
  } else {
    [settings] = await db.insert(appSettingsTable).values({ organizationId: orgId, ...parsed.data }).returning();
  }
  res.json(toApiSettings(settings));
});

export default router;
