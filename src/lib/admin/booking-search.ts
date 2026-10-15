import { balance, paymentState } from "@/lib/domain/format";
import type { Booking, ServiceCode } from "@/lib/domain/types";

export type StatusFilter = "active" | "pending" | "past" | "rejected" | "all";
export type PayFilter = "any" | "unpaid" | "partial" | "paid";

export function lastStayDay(b: Booking): string {
  return b.days[b.days.length - 1] ?? b.checkOut ?? b.checkIn;
}

/** Which bookings-list tab this booking belongs on. */
export function tabForBooking(b: Booking, today: string): Exclude<StatusFilter, "all"> {
  if (b.status === "pending") return "pending";
  if (b.status === "rejected" || b.status === "cancelled") return "rejected";
  if (b.status === "approved" && lastStayDay(b) < today) return "past";
  return "active";
}

export function matchesStatus(b: Booking, status: StatusFilter, today: string): boolean {
  if (status === "all") return true;
  // The default list keeps a finished stay that still owes money.
  if (status === "active") {
    if (b.status !== "approved") return false;
    return lastStayDay(b) >= today || balance(b) > 0;
  }
  return tabForBooking(b, today) === status;
}

function fold(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Owner name, phone (spacing ignored), and dog name, plus breed, email, and ref. */
export function matchesBookingQuery(b: Booking, raw: string): boolean {
  const needle = fold(raw.trim());
  if (!needle) return true;
  const fields = [b.dog?.name, b.dog?.breed, b.owner?.fullName, b.owner?.phone, b.owner?.email, b.ref];
  if (fields.some((v) => fold(v ?? "").includes(needle))) return true;
  const needleDigits = digits(needle);
  if (needleDigits.length >= 3 && digits(b.owner?.phone ?? "").includes(needleDigits)) return true;
  return false;
}

export function unpaidBookings(bookings: Booking[]): Booking[] {
  return bookings
    .filter((b) => b.status === "approved" && balance(b) > 0)
    .sort((a, b) => a.owner.fullName.localeCompare(b.owner.fullName, "ka") || a.checkIn.localeCompare(b.checkIn));
}

/**
 * A typed name searches every booking. With an empty query, the default
 * "active" list still includes finished stays that owe money.
 */
export function visibleBookings(
  bookings: Booking[],
  opts: {
    today: string;
    status: StatusFilter;
    service: ServiceCode | "ALL";
    pay: PayFilter;
    query: string;
    openId?: string | null;
  },
): Booking[] {
  const needle = opts.query.trim();
  return bookings
    .filter((b) => {
      if (opts.openId && b.id === opts.openId) return true;
      if (needle) return matchesBookingQuery(b, needle);
      if (opts.service !== "ALL" && b.service !== opts.service) return false;
      if (opts.pay !== "any" && (b.status !== "approved" || paymentState(b) !== opts.pay)) return false;
      return matchesStatus(b, opts.status, opts.today);
    })
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.dog.name.localeCompare(b.dog.name, "ka"));
}
