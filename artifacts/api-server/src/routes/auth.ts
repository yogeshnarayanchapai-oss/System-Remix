import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { usersTable, organizationsTable, organizationMembersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, signToken } from "../middlewares/auth";
import { z } from "zod";
const router = Router();

type UserRow = typeof usersTable.$inferSelect;
type MemberRow = typeof organizationMembersTable.$inferSelect;
type OrgRow = typeof organizationsTable.$inferSelect;

interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "admin" | "manager" | "agent";
  isPlatformAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  organizationStatus: string | null;
}

function buildUserProfile(
  user: UserRow,
  membership: MemberRow | null | undefined,
  org: OrgRow | null | undefined,
): UserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: (membership?.role as "admin" | "manager" | "agent") ?? "agent",
    isPlatformAdmin: user.isPlatformAdmin,
    organizationId: org?.id ?? null,
    organizationName: org?.name ?? null,
    organizationStatus: org?.status ?? null,
  };
}

router.get("/auth/me", requireAuth, async (req, res) => {
  const user = req.user!;
  const membership = req.membership;
  let org: OrgRow | undefined;
  if (membership?.organizationId) {
    const [o] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, membership.organizationId))
      .limit(1);
    org = o;
  }
  res.json(buildUserProfile(user, membership, org));
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  organizationName: z.string().min(1),
});

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
    return;
  }

  const { email, password, fullName, organizationName } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ message: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ email, passwordHash, fullName }).returning();
  const [org] = await db.insert(organizationsTable).values({ name: organizationName, ownerId: user.id, status: "pending" }).returning();
  const [membership] = await db.insert(organizationMembersTable).values({ organizationId: org.id, userId: user.id, role: "admin" }).returning();

  const token = signToken(user.id);
  res.status(201).json({ user: buildUserProfile(user, membership, org), token });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) { res.status(401).json({ message: "Invalid credentials" }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ message: "Invalid credentials" }); return; }

  const [membership] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.userId, user.id)).limit(1);

  let org: OrgRow | undefined;
  if (membership?.organizationId) {
    const [o] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, membership.organizationId)).limit(1);
    org = o;
  }

  const token = signToken(user.id);
  res.json({ user: buildUserProfile(user, membership, org), token });
});

router.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});

export default router;
