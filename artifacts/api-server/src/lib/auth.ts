import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";

type AuthenticatedRequest = Request & { userId?: number };

const secret = process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? "campusloop-local-development-secret";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function createToken(user: Pick<User, "id" | "role">): string {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readToken(token: string): number | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: number };
    return typeof parsed.sub === "number" ? parsed.sub : null;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const id = readToken(header.slice("Bearer ".length));
  if (!id) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user?.status === "ACTIVE" ? user : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  (req as AuthenticatedRequest).userId = user.id;
  next();
}

export function userId(req: Request): number {
  const id = (req as AuthenticatedRequest).userId;
  if (!id) throw new Error("Authenticated user missing");
  return id;
}