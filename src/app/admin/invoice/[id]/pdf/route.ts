import { buildInvoiceSheet } from "@/lib/invoice-view";
import { adminBackend } from "@/lib/server/backend";
import { requireAdmin } from "@/lib/server/auth";
import { renderInvoicePdf } from "@/lib/server/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await context.params;
  const backend = adminBackend();
  const [booking, settings] = await Promise.all([backend.getBooking(id), backend.getSettings()]);
  if (!booking) {
    return new Response("ინვოისი ვერ მოიძებნა.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pdf = await renderInvoicePdf(buildInvoiceSheet(booking, settings));
  const ascii = booking.ref.replace(/[^A-Za-z0-9_-]+/g, "") || "invoice";
  const utfName = encodeURIComponent(`ინვოისი-${booking.ref}.pdf`);

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${ascii}.pdf"; filename*=UTF-8''${utfName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
