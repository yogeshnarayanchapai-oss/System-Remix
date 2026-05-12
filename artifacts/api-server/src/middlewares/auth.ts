import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../lib/db";
import { usersTable, organizationMembersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "fallback-secret";

export interface JwtPayload {
  userId: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId } satisfies JwtPayload, JWT_SECRET, { expiresIn: "30d" });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ message: "Invalid token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  const [membership] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.userId, user.id)).limit(1);

  req.user = user;
  req.membership = membership ?? null;
  next();
}

export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user?.isPlatformAdmin) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
}
