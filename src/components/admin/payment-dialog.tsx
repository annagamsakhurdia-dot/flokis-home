"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { addPaymentAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { balance, gel } from "@/lib/domain/format";
import type { Booking, PaymentMethod } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function PaymentDialog({ b, open, onOpenChange, today }: { b: Booking; open: boolean; onOpenChange: (o: boolean) => void; today: string }) {
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
            <DialogTitle>გადახდის დამატება — {b.owner.fullName}</DialogTitle>
            <DialogDescription>
              {b.dog.name} · დარჩენილი: {gel(remaining)} (სულ {gel(b.total)})
            </DialogDescription>
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
