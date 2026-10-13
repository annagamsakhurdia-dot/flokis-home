import "server-only";
import { todayInTbilisi } from "@/lib/domain/dates";
import { resolveBooking } from "@/lib/domain/pricing";
import type { BookingRequest, QuoteResult } from "@/lib/domain/types";
import { backendMode } from "../config";
import { memoryAdminBackend, memoryPublicBackend } from "./memory";
import { supabaseAdminBackend, supabasePublicBackend } from "./supabase";
import type { AdminBackend, PublicBackend } from "./types";

export function publicBackend(): PublicBackend {
  return backendMode() === "supabase" ? supabasePublicBackend : memoryPublicBackend;
}

/** Only call after `requireAdmin()`; Supabase mode additionally enforces RLS. */
export function adminBackend(): AdminBackend {
  return backendMode() === "supabase" ? supabaseAdminBackend : memoryAdminBackend;
}

export async function quoteBooking(
  req: Pick<BookingRequest, "service" | "checkIn" | "checkOut" | "gardenPackage" | "gardenDays">,
): Promise<QuoteResult> {
  if (backendMode() === "supabase") return supabasePublicBackend.quote(req);
  const settings = await memoryPublicBackend.getPublicSettings();
  const resolved = resolveBooking(req, settings, todayInTbilisi());
  if (!resolved.ok) return resolved;
  const { quote } = resolved;
  const capacity = settings.services[req.service].capacity;
  const avail = await memoryPublicBackend.getAvailability(req.service, quote.days[0], quote.days[quote.days.length - 1]);
  const relevant = avail.filter((a) => quote.days.includes(a.date));
  const fullDays = relevant.filter((a) => a.booked >= capacity).map((a) => a.date);
  if (fullDays.length) return { ok: false, error: "full", fullDays };
  return { ok: true, quote, minFree: Math.min(...relevant.map((a) => capacity - a.booked)) };
}
