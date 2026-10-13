"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Mail, Plus, Search, Trash2 } from "lucide-react";
import { balance, dmy, gel, paidAmount, paymentState } from "@/lib/domain/format";
import type { Booking, PaymentMethod, ServiceCode } from "@/lib/domain/types";
import { ServiceIcon } from "@/components/brand/service-icon";
import { SERVICE_KA, STATUS_KA } from "@/lib/admin/stats";
import { addPaymentAction, deletePaymentAction, resendInvoiceAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BookingDetails, PriceSummary, ServiceLabel, bookingDates } from "./booking-details";

type StatusFilter = "active" | "pending" | "past" | "rejected" | "all";
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "მიმდინარე" },
  { key: "pending", label: "მოლოდინში" },
  { key: "past", label: "დასრულებული" },
  { key: "rejected", label: "უარყოფილი" },
  { key: "all", label: "ყველა" },
];
type PayFilter = "any" | "unpaid" | "partial" | "paid";

const PAY_STYLE = {
  paid: { label: "გადახდილი", cls: "bg-[#eafaf1] text-[#1a7a3c] border-[#2ecc71]" },
  partial: { label: "ნაწილობრივ", cls: "bg-[#fef9e7] text-[#7d6608] border-[#f1c40f]" },
  unpaid: { label: "გადაუხდელი", cls: "bg-[#fdf0ee] text-[#922b21] border-[#e74c3c]" },
} as const;

export function BookingsList({ bookings, today }: { bookings: Booking[]; today: string }) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [service, setService] = useState<ServiceCode | "ALL">("ALL");
  const [pay, setPay] = useState<PayFilter>("any");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bookings
      .filter((b) => {
        const lastDay = b.days[b.days.length - 1] ?? b.checkOut;
        if (status === "active" && !(b.status === "approved" && lastDay >= today)) return false;
        if (status === "pending" && b.status !== "pending") return false;
        if (status === "past" && !(b.status === "approved" && lastDay < today)) return false;
        if (status === "rejected" && !["rejected", "cancelled"].includes(b.status)) return false;
        if (service !== "ALL" && b.service !== service) return false;
        if (pay !== "any" && (b.status !== "approved" || paymentState(b) !== pay)) return false;
        if (!needle) return true;
        return [b.dog.name, b.dog.breed, b.owner.fullName, b.owner.phone, b.owner.email, b.ref].some((v) => v.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [bookings, status, service, pay, q, today]);

  return (
    <div>
      <div className="mb-3 space-y-2 rounded-2xl border-[1.5px] border-sand bg-card p-3 shadow-soft">
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <Chip key={t.key} on={status === t.key} onClick={() => setStatus(t.key)}>{t.label}</Chip>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ძებნა: ძაღლი, მეპატრონე, ჯიში, ტელეფონი, ნომერი" className="h-10 bg-cream pl-9" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <Chip on={service === "ALL"} onClick={() => setService("ALL")}>ყველა</Chip>
            {(["HOTEL", "GARDEN"] as const).map((s) => (
              <Chip key={s} on={service === s} onClick={() => setService(s)}><ServiceIcon code={s} /> {SERVICE_KA[s]}</Chip>
            ))}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["any", "unpaid", "partial", "paid"] as const).map((p) => (
            <Chip key={p} on={pay === p} onClick={() => setPay(p)}>{p === "any" ? "ნებისმიერი გადახდა" : PAY_STYLE[p].label}</Chip>
          ))}
        </div>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">ნაპოვნია: {filtered.length}</p>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-sand bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          ამ ფილტრით ჯავშნები არ მოიძებნა.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((b) => (
            <BookingRow key={b.id} b={b} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg border-[1.5px] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
        on ? "border-sage bg-sage-soft text-forest" : "border-sand bg-cream text-muted-foreground hover:border-sage/50",
      )}
    >
      {children}
    </button>
  );
}

function BookingRow({ b, today }: { b: Booking; today: string }) {
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [pending, start] = useTransition();
  const state = paymentState(b);
  const isApproved = b.status === "approved";

  function resend() {
    start(async () => {
      const res = await resendInvoiceAction(b.id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  function removePayment(id: string) {
    if (!window.confirm("წავშალოთ ეს გადახდა?")) return;
    start(async () => {
      const res = await deletePaymentAction(id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <article className={cn("rounded-2xl border-[1.5px] border-l-4 border-sand bg-card shadow-soft", isApproved ? (state === "paid" ? "border-l-[#2ecc71]" : state === "partial" ? "border-l-[#f1c40f]" : "border-l-[#e74c3c]") : "border-l-sand")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold text-forest">{b.dog.name}</span>
            <ServiceLabel b={b} />
            {!isApproved && <span className="rounded-md bg-muted px-1.5 py-px text-[10px] font-bold text-muted-foreground">{STATUS_KA[b.status]}</span>}
            {isApproved && <span className={cn("rounded-md border px-1.5 py-px text-[10px] font-bold", PAY_STYLE[state].cls)}>{PAY_STYLE[state].label}</span>}
            {isApproved && b.days.includes(today) && <span className="rounded-md bg-sage px-1.5 py-px text-[10px] font-bold text-white">აქ არის</span>}
          </div>
          <p className="truncate text-xs font-semibold">{b.owner.fullName} · {b.owner.phone}</p>
          <p className="text-xs text-muted-foreground">📅 {bookingDates(b)}</p>
        </div>
        <div className="flex items-start gap-2">
          <div>
            <PriceSummary b={b} />
            {isApproved && balance(b) > 0 && <div className="text-right text-[11px] font-semibold text-destructive">დარჩა {gel(balance(b))}</div>}
          </div>
          <ChevronDown className={cn("mt-1 size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-sand px-4 pt-3 pb-4">
          <BookingDetails b={b} />
          <div className="mt-2 text-[11px] text-muted-foreground">
            ნომერი <span className="font-mono">{b.ref}</span> · შექმნილია {dmy(b.createdAt.slice(0, 10))}
            {b.reviewedBy && <> · განიხილა {b.reviewedBy}</>}
            {b.invoiceSentAt && <> · ინვოისი გაიგზავნა {dmy(b.invoiceSentAt.slice(0, 10))}</>}
            {b.rejectReason && <> · მიზეზი: {b.rejectReason}</>}
          </div>

          {isApproved && (
            <div className="mt-3 rounded-xl bg-cream p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-forest">
                  💰 გადახდები · {gel(paidAmount(b))} / {gel(b.total)}
                </p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={pending} onClick={resend}>
                    {pending ? <Loader2 className="animate-spin" /> : <Mail />} ინვოისი
                  </Button>
                  <Button size="sm" className="bg-terracotta text-white hover:bg-[#b85a38]" onClick={() => setPayOpen(true)}>
                    <Plus /> გადახდა
                  </Button>
                </div>
              </div>
              {b.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">გადახდა ჯერ არ დაფიქსირებულა.</p>
              ) : (
                <ul className="divide-y divide-sand text-xs">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <span className="w-20 shrink-0 text-muted-foreground">{dmy(p.paidOn)}</span>
                      <span className="w-24 shrink-0">{p.method === "bank_transfer" ? "🏦 გადარიცხვა" : "🤝 ბარტერი"}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.note}{p.recordedBy && ` · ${p.recordedBy}`}</span>
                      <span className="font-bold">{gel(p.amount)}</span>
                      <button type="button" aria-label="წაშლა" disabled={pending} onClick={() => removePayment(p.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <PaymentDialog b={b} open={payOpen} onOpenChange={setPayOpen} today={today} />
    </article>
  );
}

function PaymentDialog({ b, open, onOpenChange, today }: { b: Booking; open: boolean; onOpenChange: (o: boolean) => void; today: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [note, setNote] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [pending, start] = useTransition();
  const remaining = Math.max(0, balance(b));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addPaymentAction({ bookingId: b.id, amount: Number(amount), method, note, paidOn });
      if (res.ok) {
        toast.success(res.message);
        onOpenChange(false);
        setAmount("");
        setNote("");
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-3">
          <DialogHeader>
            <DialogTitle>გადახდის დამატება — {b.dog.name}</DialogTitle>
            <DialogDescription>დარჩენილი: {gel(remaining)} (სულ {gel(b.total)})</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-1.5">
            {(["bank_transfer", "barter"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}
                className={cn("rounded-lg border-[1.5px] py-2 text-xs font-bold", method === m ? "border-sage bg-sage-soft text-forest" : "border-sand bg-cream text-muted-foreground")}>
                {m === "bank_transfer" ? "🏦 საბანკო გადარიცხვა" : "🤝 ბარტერი"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`amt-${b.id}`}>თანხა (₾)</Label>
              <Input id={`amt-${b.id}`} type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
              {remaining > 0 && (
                <button type="button" className="text-[11px] font-semibold text-sage underline" onClick={() => setAmount(String(remaining))}>
                  მთლიანი ნაშთი: {gel(remaining)}
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`date-${b.id}`}>თარიღი</Label>
              <Input id={`date-${b.id}`} type="date" required max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`note-${b.id}`}>{method === "barter" ? "ბარტერის აღწერა *" : "შენიშვნა / ბანკი"}</Label>
            <Input id={`note-${b.id}`} maxLength={300} required={method === "barter"} value={note} onChange={(e) => setNote(e.target.value)} placeholder={method === "barter" ? "მაგ: ფოტოსესია" : "მაგ: TBC, BOG"} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>გაუქმება</Button>
            <Button type="submit" disabled={pending} className="bg-terracotta text-white hover:bg-[#b85a38]">
              {pending && <Loader2 className="animate-spin" />} შენახვა
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
