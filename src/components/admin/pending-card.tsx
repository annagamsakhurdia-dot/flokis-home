"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { applyDiscount } from "@/lib/domain/pricing";
import { gel } from "@/lib/domain/format";
import type { Booking } from "@/lib/domain/types";
import { approveAction, rejectAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BookingDetails, ServiceLabel, bookingDates } from "./booking-details";

const DISCOUNTS = [0, 5, 10, 15, 20, 25, 30, 40, 50];

export function PendingCard({ b }: { b: Booking }) {
  const [discount, setDiscount] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  function run(kind: "approve" | "reject") {
    setBusy(kind);
    start(async () => {
      const res = kind === "approve" ? await approveAction(b.id, discount) : await rejectAction(b.id, reason);
      setBusy(null);
      if (res.ok) {
        toast.success(res.message);
        setRejectOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <article className="rounded-2xl border-[1.5px] border-sand bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-forest">{b.dog.name}</h3>
            <ServiceLabel b={b} />
            <span className="font-mono text-[10px] text-muted-foreground">{b.ref}</span>
          </div>
          <p className="text-sm font-semibold">{b.owner.fullName}</p>
          <p className="text-xs text-muted-foreground">📅 {bookingDates(b)}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold text-forest">{gel(applyDiscount(b.basePrice, discount))}</div>
          {discount > 0 && <div className="text-[11px] text-muted-foreground"><s>{gel(b.basePrice)}</s> · −{discount}%</div>}
        </div>
      </div>
      <BookingDetails b={b} />
      <div className="mt-4 flex flex-col gap-3 border-t border-sand pt-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">ფასდაკლება</p>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="ფასდაკლება">
            {DISCOUNTS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={discount === d}
                onClick={() => setDiscount(d)}
                className={cn(
                  "rounded-lg border-[1.5px] px-2 py-1 text-xs font-bold transition-colors",
                  discount === d ? "border-gold bg-gold-soft text-gold-ink" : "border-sand bg-cream text-muted-foreground hover:border-gold/60",
                )}
              >
                {d}%
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 flex-1 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 sm:flex-none" disabled={pending} onClick={() => setRejectOpen(true)}>
            <X /> უარყოფა
          </Button>
          <Button className="h-10 flex-1 rounded-xl bg-terracotta px-4 font-bold text-white hover:bg-[#b85a38] sm:flex-none" disabled={pending} onClick={() => run("approve")}>
            {busy === "approve" ? <Loader2 className="animate-spin" /> : <Check />} დადასტურება + ინვოისი
          </Button>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(o) => !pending && setRejectOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ჯავშნის უარყოფა — {b.dog.name}</DialogTitle>
            <DialogDescription>ადგილი გათავისუფლდება. მიზეზი შეინახება ჯავშანში.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="მიზეზი (არასავალდებულო)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={pending}>გაუქმება</Button>
            <Button variant="destructive" onClick={() => run("reject")} disabled={pending}>
              {busy === "reject" && <Loader2 className="animate-spin" />} უარყოფა
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
