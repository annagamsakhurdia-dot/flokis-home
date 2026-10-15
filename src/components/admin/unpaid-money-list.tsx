"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ServiceLabel } from "@/components/admin/booking-details";
import { PaymentDialog } from "@/components/admin/payment-dialog";
import { Button } from "@/components/ui/button";
import { balance, gel } from "@/lib/domain/format";
import type { Booking } from "@/lib/domain/types";

export function UnpaidMoneyList({ bookings, today }: { bookings: Booking[]; today: string }) {
  const [paying, setPaying] = useState<Booking | null>(null);

  return (
    <section id="unpaid" className="rounded-2xl border border-clay bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-forest">
        გადაუხდელი თანხები
        <span className="rounded-full bg-destructive px-2 py-px text-xs text-white">{bookings.length}</span>
      </h2>
      {bookings.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground">გადაუხდელი დადასტურებული ჯავშანი არ არის.</p>
      ) : (
        <ul className="divide-y divide-sand">
          {bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-forest">{b.owner.fullName}</span>
                  <ServiceLabel b={b} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{b.dog.name}</p>
              </div>
              <div className="font-extrabold text-destructive">{gel(balance(b))}</div>
              <Button size="sm" className="bg-terracotta text-white hover:bg-[#b85a38]" onClick={() => setPaying(b)}>
                <Plus /> გადახდა
              </Button>
            </li>
          ))}
        </ul>
      )}
      {paying && (
        <PaymentDialog b={paying} open today={today} onOpenChange={(o) => { if (!o) setPaying(null); }} />
      )}
    </section>
  );
}
