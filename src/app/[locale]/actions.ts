"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { addDays, diffDays, isIsoDate, todayInTbilisi } from "@/lib/domain/dates";
import { bookingRequestSchema, serviceSelectionSchema } from "@/lib/domain/schemas";
import { SERVICES, type CreateBookingResult, type DayAvailability, type QuoteResult } from "@/lib/domain/types";
import { publicBackend, quoteBooking } from "@/lib/server/backend";
import { rateLimit } from "@/lib/server/rate-limit";

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function availabilityAction(service: string, from: string, to: string): Promise<DayAvailability[]> {
  const svc = z.enum(SERVICES).parse(service);
  if (!isIsoDate(from) || !isIsoDate(to) || to < from || diffDays(from, to) > 62) throw new Error("Invalid range");
  const today = todayInTbilisi();
  const start = from < today ? today : from;
  if (start > to) return [];
  if (start > addDays(today, 400)) return [];
  return publicBackend().getAvailability(svc, start, to);
}

export async function quoteAction(input: unknown): Promise<QuoteResult> {
  const parsed = serviceSelectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return quoteBooking(parsed.data);
}

export async function submitBookingAction(input: unknown): Promise<CreateBookingResult | { ok: false; error: "network" | "rate_limited" }> {
  if (!rateLimit(`book:${await clientKey()}`, 8, 10 * 60_000)) return { ok: false, error: "rate_limited" };
  const parsed = bookingRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    return await publicBackend().createBooking(parsed.data);
  } catch (err) {
    console.error("create_booking failed", err);
    return { ok: false, error: "network" };
  }
}
