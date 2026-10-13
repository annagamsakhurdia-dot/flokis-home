import { addDays, dateRange, diffDays, isIsoDate } from "./dates";
import type {
  BookingErrorCode,
  BookingRequest,
  GardenPackageCode,
  HotelPricing,
  PriceLine,
  Quote,
  Settings,
} from "./types";

// Keep in sync with supabase/migrations/*_booking_rpcs.sql (compute_quote).
export const BOOKING_HORIZON_DAYS = 365;
export const MAX_HOTEL_NIGHTS = 180;
export const MONTH_WINDOW_DAYS = 30;

export const PACKAGE_VISITS: Record<GardenPackageCode, number | null> = {
  SINGLE: 1,
  P8: 8,
  P10: 10,
  P12: 12,
  MONTH: null,
};

export type PricingSettings = Omit<Settings, "business">;

export function packagePrice(settings: PricingSettings, code: GardenPackageCode): number {
  const g = settings.garden;
  switch (code) {
    case "SINGLE":
      return g.single;
    case "P8":
      return g.p8;
    case "P10":
      return g.p10;
    case "P12":
      return g.p12;
    case "MONTH":
      return g.month;
  }
}

/** Every full 30 nights is billed at the month rate; the remainder uses tiers 1–3 / 4–7 / 8+. */
export function hotelLines(pricing: HotelPricing, nights: number): PriceLine[] {
  const lines: PriceLine[] = [];
  const months = Math.floor(nights / 30);
  const rest = nights % 30;
  if (months > 0) {
    lines.push({ kind: "hotel_month", qty: months, unit: pricing.month, amount: months * pricing.month });
  }
  const tiers = [
    { kind: "hotel_tier1", qty: Math.min(rest, 3), unit: pricing.tier1 },
    { kind: "hotel_tier2", qty: Math.max(0, Math.min(rest, 7) - 3), unit: pricing.tier2 },
    { kind: "hotel_tier3", qty: Math.max(0, rest - 7), unit: pricing.tier3 },
  ] as const;
  for (const t of tiers) {
    if (t.qty > 0) lines.push({ kind: t.kind, qty: t.qty, unit: t.unit, amount: t.qty * t.unit });
  }
  return lines;
}

export type ResolveResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: BookingErrorCode };

/**
 * Validates the service-specific part of a booking request and computes the
 * occupied days and the price. Pure: the caller supplies settings and "today".
 */
export function resolveBooking(
  req: Pick<BookingRequest, "service" | "checkIn" | "checkOut" | "gardenPackage" | "gardenDays">,
  settings: PricingSettings,
  today: string,
): ResolveResult {
  if (!settings.services[req.service]?.active) return { ok: false, error: "service_inactive" };
  const lastAllowed = addDays(today, BOOKING_HORIZON_DAYS);
  const checkDay = (d: string): BookingErrorCode | null => {
    if (!isIsoDate(d)) return "invalid";
    if (d < today) return "past_date";
    if (d > lastAllowed) return "too_far";
    return null;
  };

  if (req.service === "HOTEL") {
    const { checkIn, checkOut } = req;
    if (!checkIn || !checkOut) return { ok: false, error: "invalid" };
    const err = checkDay(checkIn) ?? checkDay(checkOut);
    if (err) return { ok: false, error: err };
    const nights = diffDays(checkIn, checkOut);
    if (nights < 1 || nights > MAX_HOTEL_NIGHTS) return { ok: false, error: "bad_range" };
    const lines = hotelLines(settings.hotel, nights);
    return { ok: true, quote: { days: dateRange(checkIn, checkOut), lines, total: sum(lines) } };
  }

  const pkg = req.gardenPackage ?? "SINGLE";
  if (!(pkg in PACKAGE_VISITS)) return { ok: false, error: "invalid" };
  const days = [...new Set(req.gardenDays ?? [])].sort();
  for (const d of days) {
    const err = checkDay(d);
    if (err) return { ok: false, error: err };
  }
  const visits = PACKAGE_VISITS[pkg];
  if (visits !== null && days.length !== visits) return { ok: false, error: "bad_package_days" };
  if (visits === null) {
    if (days.length < 1 || diffDays(days[0], days[days.length - 1]) >= MONTH_WINDOW_DAYS) {
      return { ok: false, error: "bad_package_days" };
    }
  }
  const price = packagePrice(settings, pkg);
  const line: PriceLine =
    pkg === "SINGLE"
      ? { kind: "garden_single", qty: 1, unit: price, amount: price }
      : { kind: "garden_package", qty: days.length, unit: price, amount: price, packageCode: pkg };
  return { ok: true, quote: { days, lines: [line], total: price } };
}

function sum(lines: PriceLine[]): number {
  return lines.reduce((acc, l) => acc + l.amount, 0);
}

export function applyDiscount(base: number, discountPct: number): number {
  return Math.round(base * (100 - discountPct)) / 100;
}
