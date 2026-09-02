import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { db } from "./db";
import { appSecret } from "./secret";

const COOKIE = "maraka_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

async function secret(): Promise<Uint8Array> {
  return new TextEncoder().encode(await appSecret());
}

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: "COMMISSIONER" | "MANAGER";
  teamId: string | null;
  leagueId: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(await secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** La sessione corrente, oppure null. Non reindirizza: usala dove l'accesso è facoltativo. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, await secret());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role === "COMMISSIONER" ? "COMMISSIONER" : "MANAGER",
      teamId: payload.teamId ? String(payload.teamId) : null,
      leagueId: String(payload.leagueId),
    };
  } catch {
    return null;
  }
}

/** La sessione corrente; se manca, porta al login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Solo il commissioner: amministrazione, import, apertura e chiusura delle sessioni. */
export async function requireCommissioner(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "COMMISSIONER") redirect("/lega");
  return session;
}

/**
 * La squadra del manager. Il commissioner non ne ha una (art. 1.2): quando deve
 * agire su una squadra lo fa esplicitamente dal pannello, non per identità.
 */
export async function requireTeam(): Promise<{ session: Session; teamId: string }> {
  const session = await requireSession();
  if (!session.teamId) redirect("/lega");
  return { session, teamId: session.teamId };
}

/** Il manager può agire su questa squadra? Il commissioner non può: non è la sua. */
export function canActFor(session: Session, teamId: string): boolean {
  return session.role === "MANAGER" && session.teamId === teamId;
}

export async function authenticate(email: string, password: string): Promise<Session | null> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    teamId: user.teamId,
    leagueId: user.leagueId,
  };
}
