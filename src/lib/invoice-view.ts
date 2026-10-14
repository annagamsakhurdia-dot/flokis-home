import { SERVICE_KA, PACKAGE_KA } from "@/lib/admin/stats";
import { dmy, gel, lineLabel } from "@/lib/domain/format";
import { applyDiscount } from "@/lib/domain/pricing";
import type { Booking, Settings } from "@/lib/domain/types";
import { dictionaries } from "@/lib/i18n/dictionaries";

export interface InvoiceLine {
  label: string;
  amount: string;
}

export interface InvoiceField {
  label: string;
  value: string;
}

export interface InvoiceSheet {
  brand: string;
  ref: string;
  details: InvoiceField[];
  lines: InvoiceLine[];
  discount: InvoiceLine | null;
  totalLabel: string;
  total: string;
  bankIntro: string;
  bank: InvoiceField[];
  thanks: string;
}

function show(value: string): string {
  const trimmed = value.trim();
  return trimmed || "—";
}

function datesOf(b: Booking): string {
  if (b.service === "HOTEL") return `${dmy(b.checkIn)} – ${dmy(b.checkOut)}`;
  if (b.days.length === 0) return "—";
  return b.days.map(dmy).join(", ");
}

/** Georgian invoice sheet. Bank lines come from the booking's settings, not from constants. */
export function buildInvoiceSheet(b: Booking, settings: Settings): InvoiceSheet {
  const t = dictionaries.ka.invoice;
  const biz = settings.business;
  const serviceName = settings.services[b.service].nameKa.trim() || SERVICE_KA[b.service];
  const packageName = b.gardenPackage && b.gardenPackage !== "SINGLE" ? PACKAGE_KA[b.gardenPackage] : "";
  const service = packageName ? `${serviceName} · ${packageName}` : serviceName;
  const discountAmount = b.basePrice - applyDiscount(b.basePrice, b.discountPct);

  return {
    brand: biz.name.trim() || dictionaries.ka.brand,
    ref: b.ref,
    details: [
      { label: "ძაღლი", value: show(b.dog.name) },
      { label: "მეპატრონე", value: show(b.owner.fullName) },
      { label: "ტელეფონი", value: show(b.owner.phone) },
      { label: "სერვისი", value: service },
      { label: "თარიღები", value: datesOf(b) },
      { label: "ჯავშნის ნომერი", value: show(b.ref) },
    ],
    lines: b.priceLines.map((line) => ({ label: lineLabel(line, dictionaries.ka), amount: gel(line.amount) })),
    discount:
      b.discountPct > 0
        ? { label: `${t.discount} ${b.discountPct}%`, amount: `−${gel(discountAmount)}` }
        : null,
    totalLabel: t.toPay,
    total: gel(b.total),
    bankIntro: t.bank,
    bank: [
      { label: "ბანკი", value: show(biz.bankName) },
      { label: "IBAN", value: show(biz.iban) },
      { label: t.accountNumber, value: show(biz.accountNumber) },
      { label: t.accountHolder, value: show(biz.recipient) },
      { label: t.reference, value: show(b.ref) },
    ],
    thanks: t.thanks,
  };
}
