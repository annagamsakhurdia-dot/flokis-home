import Link from "next/link";
import { connection } from "next/server";
import { InvoiceSheetView } from "@/components/admin/invoice-sheet";
import { InvoiceToolbar } from "@/components/admin/invoice-toolbar";
import { buildInvoiceSheet } from "@/lib/invoice-view";
import { adminBackend } from "@/lib/server/backend";
import { requireAdmin } from "@/lib/server/auth";

export const metadata = { title: "ინვოისი — ფლოკის სახლი" };

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const { auto } = await searchParams;
  const backend = adminBackend();
  const [booking, settings] = await Promise.all([backend.getBooking(id), backend.getSettings()]);

  if (!booking) {
    return (
      <main className="invoice-print-root">
        <p className="invoice-missing">ინვოისი ვერ მოიძებნა.</p>
        <p className="invoice-missing">
          <Link href="/admin/bookings">ჯავშნებზე დაბრუნება</Link>
        </p>
      </main>
    );
  }

  const mode = auto === "print" || auto === "save" ? auto : null;

  return (
    <main className="invoice-print-root">
      <InvoiceToolbar mode={mode} />
      <InvoiceSheetView sheet={buildInvoiceSheet(booking, settings)} />
    </main>
  );
}
