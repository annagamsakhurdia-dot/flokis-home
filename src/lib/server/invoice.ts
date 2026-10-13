import "server-only";
import { applyDiscount } from "@/lib/domain/pricing";
import { dmy, escapeHtml, gel, lineLabel } from "@/lib/domain/format";
import type { Booking, BusinessSettings, Settings } from "@/lib/domain/types";
import { dictionaries, format } from "@/lib/i18n/dictionaries";
import type { OutgoingEmail } from "./email";

function serviceName(b: Booking, settings: Settings): string {
  const s = settings.services[b.service];
  return b.locale === "en" ? s.nameEn : b.locale === "uk" ? s.nameUk : s.nameKa;
}

function dateText(b: Booking): string {
  if (b.service === "HOTEL") return `${dmy(b.checkIn)} → ${dmy(b.checkOut)}`;
  return b.days.map(dmy).join(", ");
}

export function buildInvoiceEmail(b: Booking, settings: Settings): OutgoingEmail {
  const dict = dictionaries[b.locale];
  const t = dict.invoice;
  const biz: BusinessSettings = settings.business;
  const e = escapeHtml;

  const rows: [string, string][] = b.priceLines.map((l) => [lineLabel(l, dict), gel(l.amount)]);
  if (b.discountPct > 0) {
    rows.push([`${t.discount} ${b.discountPct}%`, `−${gel(b.basePrice - applyDiscount(b.basePrice, b.discountPct))}`]);
  }
  const bankRows: [string, string][] = [
    ["Bank", biz.bankName || "—"],
    ["IBAN", biz.iban || "—"],
    [t.accountNumber, biz.accountNumber || "—"],
    [t.accountHolder, biz.recipient || "—"],
    [t.reference, b.ref],
  ];

  const letterhead = biz.name && biz.name !== "Grayson's" && biz.name !== "ფლოკის სახლი" ? biz.name : dict.brand;
  const subject = format(t.subject, { ref: b.ref });
  const html = `<!doctype html><html><body style="margin:0;background:#f7f5f0;font-family:'Noto Sans Georgian',Arial,sans-serif;color:#1a1a1a">
<div style="max-width:540px;margin:0 auto;padding:24px">
  <div style="background:#3B2418;border-radius:16px;padding:24px;color:#fff;text-align:center">
    <div style="font-family:Fraunces,'Noto Sans Georgian',Georgia,serif;font-size:26px;font-weight:700">${e(letterhead)}</div>
    <div style="opacity:.8;font-size:13px">${e(b.ref)}</div>
  </div>
  <div style="background:#fff;border:1.5px solid #e0ddd6;border-radius:16px;padding:20px;margin-top:12px">
    <p>${e(format(t.hello, { name: b.owner.fullName }))}</p>
    <p>${e(format(t.body, { dog: b.dog.name }))}</p>
    <p><strong>${e(serviceName(b, settings))}</strong> · ${e(dateText(b))}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${e(k)}</td><td style="text-align:right;border-bottom:1px solid #eee">${e(v)}</td></tr>`).join("")}
      <tr><td style="padding:10px 0;font-weight:800">${e(t.toPay)}</td><td style="text-align:right;font-weight:800;font-size:18px">${e(gel(b.total))}</td></tr>
    </table>
    <p style="margin-top:16px">${e(t.bank)}</p>
    <table style="font-size:14px">${bankRows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#888">${e(k)}</td><td><strong>${e(v)}</strong></td></tr>`).join("")}</table>
    <p style="margin-top:16px">${e(t.thanks)}</p>
  </div>
  ${[biz.phone, biz.invoiceSenderEmail].filter(Boolean).length ? `<p style="text-align:center;color:#888;font-size:12px">${[biz.phone, biz.invoiceSenderEmail].filter(Boolean).map(e).join(" · ")}</p>` : ""}
</div></body></html>`;

  const text = [
    format(t.hello, { name: b.owner.fullName }),
    format(t.body, { dog: b.dog.name }),
    `${serviceName(b, settings)} · ${dateText(b)}`,
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `${t.toPay}: ${gel(b.total)}`,
    t.bank,
    ...bankRows.map(([k, v]) => `${k}: ${v}`),
    t.thanks,
    [biz.phone, biz.invoiceSenderEmail].filter(Boolean).join(" · "),
  ].filter(Boolean).join("\n");

  return { to: b.owner.email, subject, html, text };
}
