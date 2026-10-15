"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Mail, Plus, Search, Trash2 } from "lucide-react";
import { balance, dmy, gel, paidAmount, paymentState } from "@/lib/domain/format";
import type { Booking, ServiceCode } from "@/lib/domain/types";
import { ServiceIcon } from "@/components/brand/service-icon";
import { tabForBooking, visibleBookings, type PayFilter, type StatusFilter } from "@/lib/admin/booking-search";
import { SERVICE_KA, STATUS_KA } from "@/lib/admin/stats";
import { deletePaymentAction } from "@/app/admin/actions";
import { PaymentDialog } from "./payment-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BookingDetails, PriceSummary, ServiceLabel, bookingDates } from "./booking-details";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "მიმდინარე" },
  { key: "pending", label: "მოლოდინში" },
  { key: "past", label: "დასრულებული" },
  { key: "rejected", label: "უარყოფილი" },
  { key: "all", label: "ყველა" },
];

function parseStatus(value: string | null): StatusFilter {
  if (value === "active" || value === "pending" || value === "past" || value === "rejected" || value === "all") return value;
  return "active";
}

function parsePay(value: string | null): PayFilter {
  if (value === "any" || value === "unpaid" || value === "partial" || value === "paid") return value;
  return "any";
}

const PAY_STYLE = {
  paid: { label: "გადახდილი", cls: "bg-[#eafaf1] text-[#1a7a3c] border-[#2ecc71]" },
  partial: { label: "ნაწილობრივ", cls: "bg-[#fef9e7] text-[#7d6608] border-[#f1c40f]" },
  unpaid: { label: "გადაუხდელი", cls: "bg-[#fdf0ee] text-[#922b21] border-[#e74c3c]" },
} as const;

export function BookingsList({ bookings, today }: { bookings: Booking[]; today: string }) {
  const sp = useSearchParams();
  const openId = sp.get("open");
  const opened = openId ? bookings.find((b) => b.id === openId) : undefined;
  const [status, setStatus] = useState<StatusFilter>(opened ? tabForBooking(opened, today) : parseStatus(sp.get("status")));
  const [service, setService] = useState<ServiceCode | "ALL">("ALL");
  const [pay, setPay] = useState<PayFilter>(parsePay(sp.get("pay")));
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => visibleBookings(bookings, { today, status, service, pay, query: q, openId }),
    [bookings, status, service, pay, q, today, openId],
  );

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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ძებნა: მეპატრონე, ტელეფონი ან ძაღლი" className="h-10 bg-cream pl-9" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <Chip quiet on={service === "ALL"} onClick={() => setService("ALL")}>სასტუმრო და ბაღი</Chip>
            {(["HOTEL", "GARDEN"] as const).map((s) => (
              <Chip quiet key={s} on={service === s} onClick={() => setService(s)}><ServiceIcon code={s} /> {SERVICE_KA[s]}</Chip>
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
            <BookingRow key={`${b.id}:${b.id === openId ? "open" : "shut"}`} b={b} today={today} startOpen={b.id === openId} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, quiet, children }: { on: boolean; onClick: () => void; quiet?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg border-[1.5px] whitespace-nowrap transition-colors",
        quiet ? "px-2 py-1 text-[11px] font-medium" : "px-2.5 py-1.5 text-xs font-semibold",
        on ? "border-sage bg-sage-soft text-forest" : "border-sand bg-cream text-muted-foreground hover:border-sage/50",
      )}
    >
      {children}
    </button>
  );
}

function BookingRow({ b, today, startOpen }: { b: Booking; today: string; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [payOpen, setPayOpen] = useState(false);
  const [pending, start] = useTransition();
  const articleRef = useRef<HTMLElement>(null);
  const state = paymentState(b);
  const isApproved = b.status === "approved";

  useEffect(() => {
    if (!startOpen) return;
    articleRef.current?.scrollIntoView({ block: "center" });
  }, [startOpen]);

  function removePayment(id: string) {
    if (!window.confirm("წავშალოთ ეს გადახდა?")) return;
    start(async () => {
      const res = await deletePaymentAction(id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <article ref={articleRef} id={`booking-${b.id}`} className={cn("rounded-2xl border-[1.5px] border-l-4 border-sand bg-card shadow-soft", isApproved ? (state === "paid" ? "border-l-[#2ecc71]" : state === "partial" ? "border-l-[#f1c40f]" : "border-l-[#e74c3c]") : "border-l-sand")}>
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

          {!isApproved && b.status === "pending" && (
            <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-xs text-muted-foreground">
              გადახდა ჩაიწერება დადასტურების შემდეგ. დაადასტურეთ მოთხოვნა მიმოხილვიდან.
            </p>
          )}

          {isApproved && (
            <div className="mt-3 rounded-xl bg-cream p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-forest">
                  💰 გადახდები · {gel(paidAmount(b))} / {gel(b.total)}
                </p>
                <div className="flex gap-1.5">
                  <a
                    href={`/admin/invoice/${b.id}/pdf`}
                    download={`ინვოისი-${b.ref}.pdf`}
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    <Mail /> ინვოისი
                  </a>
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

