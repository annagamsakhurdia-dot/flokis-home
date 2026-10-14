"use client";

import { useEffect } from "react";
import Link from "next/link";

export function InvoiceToolbar({ mode }: { mode: "print" | "save" | null }) {
  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    const timers: number[] = [];
    const openDialog = () => {
      if (cancelled) return;
      timers.push(window.setTimeout(() => window.print(), 200));
    };
    if (document.fonts?.ready) void document.fonts.ready.then(openDialog);
    else openDialog();
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [mode]);

  return (
    <div className="invoice-toolbar no-print">
      <Link href="/admin/bookings" className="invoice-back">
        ← ჯავშნები
      </Link>
      <div className="invoice-actions">
        <button type="button" className="invoice-btn" onClick={() => window.print()}>
          დაბეჭდვა
        </button>
        <div className="invoice-save">
          <button type="button" className="invoice-btn invoice-btn-solid" onClick={() => window.print()}>
            PDF-ად შენახვა
          </button>
          <p>დიალოგში აირჩიეთ „Save as PDF“ ან „Microsoft Print to PDF“.</p>
        </div>
      </div>
    </div>
  );
}
