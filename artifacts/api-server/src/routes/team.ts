import { Router } from "express";
import { db } from "../lib/db";
import { usersTable, organizationMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router = Router();

type MemberRow = typeof organizationMembersTable.$inferSelect;

function getOrgId(req: Express.Request): string | null {
  return (req as any).membership?.organizationId ?? null;
}

router.get("/team/members", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.json([]); return; }

  const members = await db
    .select({
      id: organizationMembersTable.id,
      userId: organizationMembersTable.userId,
      organizationId: organizationMembersTable.organizationId,
      role: organizationMembersTable.role,
      joinedAt: organizationMembersTable.joinedAt,
      email: usersTable.email,
      fullName: usersTable.fullName,
    })
    .from(organizationMembersTable)
    .innerJoin(usersTable, eq(organizationMembersTable.userId, usersTable.id))
    .where(eq(organizationMembersTable.organizationId, orgId));

  res.json(members.map((m) => ({
    id: m.id,
    userId: m.userId,
    organizationId: m.organizationId,
    role: m.role as "admin" | "manager" | "agent",
    email: m.email ?? null,
    fullName: m.fullName ?? null,
    joinedAt: m.joinedAt?.toISOString() ?? null,
  })));
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "manager", "agent"]),
});

router.post("/team/members", requireAuth, async (req, res) => {
  const orgId = getOrgId(req);
  if (!orgId) { res.status(403).json({ message: "No organization" }); return; }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const { email, role } = parsed.data;
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    const tempPassword = await bcrypt.hash(crypto.randomUUID(), 10);
    [user] = await db.insert(usersTable).values({ email, passwordHash: tempPassword }).returning();
  }

  const [existing] = await db.select().from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.organizationId, orgId), eq(organizationMembersTable.userId, user.id)))
    .limit(1);

  if (existing) { res.status(409).json({ message: "Already a member" }); return; }

  const [membership] = await db.insert(organizationMembersTable)
    .values({ organizationId: orgId, userId: user.id, role, invitedBy: (req as any).user.id })
    .returning();

  res.status(201).json({
    id: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    role: membership.role as "admin" | "manager" | "agent",
    email: user.email ?? null,
    fullName: user.fullName ?? null,
    joinedAt: membership.joinedAt?.toISOString() ?? null,
  });
});

const memberUpdateSchema = z.object({
  role: z.enum(["admin", "manager", "agent"]),
});

router.patch("/team/members/:id", requireAuth, async (req, res) => {
  const parsed = memberUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid input" }); return; }

  const [membership] = await db.update(organizationMembersTable)
    .set({ role: parsed.data.role })
    .where(eq(organizationMembersTable.id, String(req.params.id)))
    .returning();

  if (!membership) { res.status(404).json({ message: "Not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, membership.userId)).limit(1);

  res.json({
    id: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    role: membership.role as "admin" | "manager" | "agent",
    email: user?.email ?? null,
    fullName: user?.fullName ?? null,
    joinedAt: membership.joinedAt?.toISOString() ?? null,
  });
});

router.delete("/team/members/:id", requireAuth, async (req, res) => {
  await db.delete(organizationMembersTable).where(eq(organizationMembersTable.id, String(req.params.id)));
  res.status(204).send();
});

export default router;
