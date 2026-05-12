import { Router } from "express";
import { db } from "../lib/db";
import { organizationsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requirePlatformAdmin } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

type OrgRow = typeof organizationsTable.$inferSelect;

function toApiOrg(org: OrgRow, ownerEmail?: string | null) {
  return {
    id: org.id,
    name: org.name,
    status: org.status,
    ownerId: org.ownerId,
    ownerEmail: ownerEmail ?? null,
    plan: org.plan,
    maxPages: org.maxPages,
    maxTeamMembers: org.maxTeamMembers,
    rejectedReason: org.rejectedReason ?? null,
    approvedAt: org.approvedAt?.toISOString() ?? null,
    createdAt: org.createdAt.toISOString(),
  };
}

router.get("/organizations", requireAuth, requirePlatformAdmin, async (req, res) => {
  const orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.createdAt);
  const ownerIds = [...new Set(orgs.map((o: OrgRow) => o.ownerId))];
  let ownerMap = new Map<string, string>();
  if (ownerIds.length) {
    const owners = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
    ownerMap = new Map(owners.map((u) => [u.id, u.email]));
  }
  res.json(orgs.map((o: OrgRow) => toApiOrg(o, ownerMap.get(o.ownerId))));
});

router.get("/organizations/:id", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  if (!org) { res.status(404).json({ message: "Not found" }); return; }

  const [owner] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, org.ownerId)).limit(1);
  res.json(toApiOrg(org, owner?.email));
});

const updateSchema = z.object({
  name: z.string().optional(),
  maxPages: z.number().int().optional(),
  maxTeamMembers: z.number().int().optional(),
  plan: z.string().optional(),
});

router.patch("/organizations/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const id = String(req.params.id);
  const [org] = await db.update(organizationsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(organizationsTable.id, id)).returning();
  if (!org) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiOrg(org));
});

router.delete("/organizations/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  await db.delete(organizationsTable).where(eq(organizationsTable.id, String(req.params.id)));
  res.status(204).send();
});

router.post("/organizations/:id/approve", requireAuth, requirePlatformAdmin, async (req, res) => {
  const id = String(req.params.id);
  const [org] = await db.update(organizationsTable)
    .set({ status: "approved", approvedBy: req.user!.id, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizationsTable.id, id))
    .returning();
  if (!org) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiOrg(org));
});

router.post("/organizations/:id/reject", requireAuth, requirePlatformAdmin, async (req, res) => {
  const id = String(req.params.id);
  const { reason } = req.body as { reason?: string };
  const [org] = await db.update(organizationsTable)
    .set({ status: "rejected", rejectedReason: reason ?? null, updatedAt: new Date() })
    .where(eq(organizationsTable.id, id))
    .returning();
  if (!org) { res.status(404).json({ message: "Not found" }); return; }
  res.json(toApiOrg(org));
});

export default router;
