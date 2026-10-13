import { balance, paidAmount } from "@/lib/domain/format";
import type { Booking, ServiceCode } from "@/lib/domain/types";

export const SERVICE_KA: Record<ServiceCode, string> = { HOTEL: "სასტუმრო", GARDEN: "ბაღი" };
export const STATUS_KA: Record<Booking["status"], string> = {
  pending: "მოლოდინში",
  approved: "დადასტურებული",
  rejected: "უარყოფილი",
  cancelled: "გაუქმებული",
};
export const PACKAGE_KA: Record<string, string> = {
  SINGLE: "ერთჯერადი",
  P8: "8 ვიზიტი",
  P10: "10 ვიზიტი",
  P12: "12 ვიზიტი",
  MONTH: "1 თვე",
};
export const MONTHS_KA = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
export const WEEKDAYS_KA = ["ორ", "სა", "ოთ", "ხუ", "პა", "შა", "კვ"];

export function onDay(bookings: Booking[], day: string, service?: ServiceCode, statuses: Booking["status"][] = ["approved"]) {
  return bookings.filter((b) => statuses.includes(b.status) && (!service || b.service === service) && b.days.includes(day));
}

/** Revenue spread evenly across occupied days, so stays crossing months/years land correctly. */
export function revenueForPeriod(bookings: Booking[], prefix: string): number {
  let sum = 0;
  for (const b of bookings) {
    if (b.status !== "approved" || b.days.length === 0) continue;
    const share = b.total / b.days.length;
    sum += b.days.filter((d) => d.startsWith(prefix)).length * share;
  }
  return Math.round(sum);
}

export function dashboardStats(bookings: Booking[], today: string) {
  const approved = bookings.filter((b) => b.status === "approved");
  return {
    pending: bookings.filter((b) => b.status === "pending").length,
    hotelToday: onDay(bookings, today, "HOTEL").length,
    gardenToday: onDay(bookings, today, "GARDEN").length,
    monthRevenue: revenueForPeriod(bookings, today.slice(0, 7)),
    yearRevenue: revenueForPeriod(bookings, today.slice(0, 4)),
    unpaid: Math.round(approved.reduce((acc, b) => acc + Math.max(0, balance(b)), 0) * 100) / 100,
    received: Math.round(approved.reduce((acc, b) => acc + paidAmount(b), 0) * 100) / 100,
  };
}
