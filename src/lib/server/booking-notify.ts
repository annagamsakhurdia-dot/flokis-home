import "server-only";
import { dmy, escapeHtml, gel } from "@/lib/domain/format";
import type { BookingRequest } from "@/lib/domain/types";
import { emailTransport, sendEmail, type OutgoingEmail } from "./email";

const DEFAULT_NOTIFY_EMAIL = "mikheilkachkachishvili@gmail.com";
const DEFAULT_FROM = "Floki's Home <onboarding@resend.dev>";
const SUBJECT = "ახალი ჯავშანი — ფლოკის სახლი";

/** Staff inbox for a new guest booking. BOOKING_NOTIFY_EMAIL overrides the default. */
export function bookingNotifyRecipient(): string {
  return process.env.BOOKING_NOTIFY_EMAIL?.trim() || DEFAULT_NOTIFY_EMAIL;
}

/**
 * Resend `from` for the staff notice.
 * A verified domain address in INVOICE_FROM_EMAIL or RESEND_FROM wins.
 * Otherwise the Resend onboarding sender, which only delivers to the Resend account email.
 */
export function bookingNotifyFrom(): string {
  return process.env.INVOICE_FROM_EMAIL?.trim() || process.env.RESEND_FROM?.trim() || DEFAULT_FROM;
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function serviceLabel(service: BookingRequest["service"]): string {
  return service === "HOTEL" ? "სასტუმრო" : "ბაღი";
}

function datesLabel(req: BookingRequest, days: string[]): string {
  if (req.service === "HOTEL" && req.checkIn && req.checkOut) {
    return `${dmy(req.checkIn)} → ${dmy(req.checkOut)}`;
  }
  if (days.length === 0) return "—";
  return days.map(dmy).join(", ");
}

export function buildNewBookingEmail(
  req: BookingRequest,
  result: { ref: string; total: number; days: string[] },
): OutgoingEmail {
  const lines = [
    `ძაღლის სახელი: ${oneLine(req.dog.name)}`,
    `მფლობელი: ${oneLine(req.owner.fullName)}`,
    `ტელეფონი: ${oneLine(req.owner.phone)}`,
    `ელფოსტა: ${oneLine(req.owner.email)}`,
    `სერვისი: ${serviceLabel(req.service)}`,
    `თარიღები: ${datesLabel(req, result.days)}`,
    `ფასი: ${gel(result.total)}`,
    `ჯავშნის ნომერი: ${result.ref}`,
  ];
  const text = lines.join("\n");
  const html = `<p>${lines.map((line) => escapeHtml(line)).join("<br>")}</p>`;
  return { to: bookingNotifyRecipient(), subject: SUBJECT, html, text };
}

/**
 * One plain-text notice after a booking is stored.
 * Missing RESEND_API_KEY skips the send. A provider error is logged.
 * Neither case throws — the guest booking already succeeded.
 */
export async function notifyNewBooking(
  req: BookingRequest,
  result: { ref: string; total: number; days: string[] },
): Promise<void> {
  if (emailTransport() !== "resend") {
    console.info("[booking email] skipped: RESEND_API_KEY is not set");
    return;
  }
  try {
    await sendEmail(buildNewBookingEmail(req, result), bookingNotifyFrom());
  } catch (err) {
    console.error("[booking email] send failed", err);
  }
}
