import "server-only";
import { randomUUID } from "node:crypto";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SentEmail extends OutgoingEmail {
  id: string;
  from: string;
  sentAt: string;
  transport: "mock" | "resend";
}

const globalOutbox = globalThis as unknown as { __graysonsOutbox?: SentEmail[] };

export function mockOutbox(): SentEmail[] {
  return (globalOutbox.__graysonsOutbox ??= []);
}

export function emailTransport(): "mock" | "resend" {
  return process.env.RESEND_API_KEY ? "resend" : "mock";
}

/**
 * Sends via Resend when RESEND_API_KEY is set; otherwise records the message in
 * an in-memory outbox (visible at /admin/outbox) and logs it.
 * `senderFromSettings` is the invoice sender from settings. Resend only
 * delivers when that address's domain is verified there; a @gmail.com
 * address is stored and shown, but Resend will reject it as `from`.
 */
export async function sendEmail(msg: OutgoingEmail, senderFromSettings: string): Promise<SentEmail> {
  const from = senderFromSettings || process.env.INVOICE_FROM_EMAIL || "ფლოკის სახლი <invoices@example.invalid>";
  const transport = emailTransport();
  if (transport === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) throw new Error(`Email provider error ${res.status}: ${await res.text()}`);
  } else {
    console.info(`[mock email] from=${from} to=${msg.to} subject=${msg.subject}`);
  }
  const sent: SentEmail = { ...msg, id: randomUUID(), from, sentAt: new Date().toISOString(), transport };
  if (transport === "mock") mockOutbox().unshift(sent);
  return sent;
}
