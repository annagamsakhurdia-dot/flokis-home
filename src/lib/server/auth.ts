import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AdminUser } from "@/lib/domain/types";
import { backendMode, sessionSecret } from "./config";
import { findMemoryAdmin, verifyMemoryAdmin } from "./backend/memory";
import { userClient } from "./backend/supabase";

export const MEMORY_SESSION_COOKIE = "gh_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function readMemorySession(raw: string | undefined): string | null {
  if (!raw) return null;
  const [id, exp, mac] = raw.split(".");
  if (!id || !exp || !mac) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return id;
}

export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  if (backendMode() === "memory") {
    const id = readMemorySession((await cookies()).get(MEMORY_SESSION_COOKIE)?.value);
    return id ? findMemoryAdmin(id) : null;
  }
  const db = await userClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: row } = await db.from("admins").select("full_name, role").eq("user_id", auth.user.id).maybeSingle();
  if (!row) return null;
  return { id: auth.user.id, email: auth.user.email ?? "", fullName: row.full_name, role: row.role };
});

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60_000;

export type SignInResult = { ok: true } | { ok: false; error: "invalid" | "not_admin" | "locked" };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const key = email.trim().toLowerCase();
  const entry = attempts.get(key);
  if (entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()) return { ok: false, error: "locked" };

  const fail = (error: "invalid" | "not_admin"): SignInResult => {
    const prev = attempts.get(key);
    const count = prev && prev.until > Date.now() ? prev.count + 1 : 1;
    attempts.set(key, { count, until: Date.now() + LOCK_MS });
    return { ok: false, error };
  };

  if (backendMode() === "memory") {
    const admin = verifyMemoryAdmin(key, password);
    if (!admin) return fail("invalid");
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const payload = `${admin.id}.${exp}`;
    (await cookies()).set(MEMORY_SESSION_COOKIE, `${payload}.${sign(payload)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    attempts.delete(key);
    return { ok: true };
  }

  const db = await userClient();
  const { data, error } = await db.auth.signInWithPassword({ email: key, password });
  if (error || !data.user) return fail("invalid");
  const { data: row } = await db.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!row) {
    await db.auth.signOut();
    return fail("not_admin");
  }
  attempts.delete(key);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (backendMode() === "memory") {
    (await cookies()).delete(MEMORY_SESSION_COOKIE);
    return;
  }
  const db = await userClient();
  await db.auth.signOut();
}
