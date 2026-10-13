import type { Booking, PriceLine } from "./types";

export function gel(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}₾`;
}

/** DD.MM.YYYY */
export function dmy(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export function paidAmount(b: Pick<Booking, "payments">): number {
  return b.payments.reduce((acc, p) => acc + p.amount, 0);
}

export function balance(b: Pick<Booking, "payments" | "total">): number {
  return Math.round((b.total - paidAmount(b)) * 100) / 100;
}

export type PaymentState = "paid" | "partial" | "unpaid";

export function paymentState(b: Pick<Booking, "payments" | "total">): PaymentState {
  const paid = paidAmount(b);
  if (paid <= 0) return "unpaid";
  return paid >= b.total ? "paid" : "partial";
}

export function lineLabel(line: PriceLine, dict: Record<string, unknown>): string {
  const tpl = dict[`line_${line.kind}`];
  const text = typeof tpl === "string" ? tpl : line.kind;
  return text.replace("{qty}", String(line.qty)).replace("{unit}", String(line.unit));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
