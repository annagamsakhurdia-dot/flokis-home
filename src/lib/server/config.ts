import "server-only";

export type BackendMode = "memory" | "supabase";

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function backendMode(): BackendMode {
  return supabaseConfig() ? "supabase" : "memory";
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && backendMode() === "memory") {
    throw new Error("SESSION_SECRET (32+ chars) is required in production when running without Supabase.");
  }
  return "dev-only-session-secret-change-me-0123456789";
}
