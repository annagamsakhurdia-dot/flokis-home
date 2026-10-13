"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import type { ServiceCode, Settings } from "@/lib/domain/types";
import { ServiceIcon } from "@/components/brand/service-icon";
import { saveSettingsAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  const setService = (code: ServiceCode, patch: Partial<Settings["services"][ServiceCode]>) =>
    setS((prev) => ({ ...prev, services: { ...prev.services, [code]: { ...prev.services[code], ...patch } } }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveSettingsAction(s);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={save} className="space-y-4 pb-20">
      <Card title="სერვისები და ადგილები">
        <div className="grid gap-3 md:grid-cols-2">
          {(["HOTEL", "GARDEN"] as const).map((code) => {
            const svc = s.services[code];
            return (
              <div key={code} className="rounded-xl border-[1.5px] border-sand bg-cream p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-bold"><ServiceIcon code={code} /> {svc.nameKa}</span>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    {svc.active ? "აქტიური" : "გამორთული"}
                    <Switch checked={svc.active} onCheckedChange={(v) => setService(code, { active: v })} />
                  </label>
                </div>
                <NumField id={`cap-${code}`} label="ადგილები დღეში" value={svc.capacity} step={1} onChange={(v) => setService(code, { capacity: v })} />
                <TextField id={`ka-${code}`} label="სახელი (ქართ.)" value={svc.nameKa} onChange={(v) => setService(code, { nameKa: v })} />
                <TextField id={`en-${code}`} label="Name (EN)" value={svc.nameEn} onChange={(v) => setService(code, { nameEn: v })} />
                <TextField id={`uk-${code}`} label="Назва (UK)" value={svc.nameUk} onChange={(v) => setService(code, { nameUk: v })} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">სასტუმროს ადგილები — სტუმრებისთვის ხელმისაწვდომი რაოდენობა (მუდმივი ბინადრების გარეშე).</p>
      </Card>

      <Card title="სასტუმროს ფასები (₾ ღამეში)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumField id="t1" label="ღამე 1–3" value={s.hotel.tier1} onChange={(v) => setS({ ...s, hotel: { ...s.hotel, tier1: v } })} />
          <NumField id="t2" label="ღამე 4–7" value={s.hotel.tier2} onChange={(v) => setS({ ...s, hotel: { ...s.hotel, tier2: v } })} />
          <NumField id="t3" label="ღამე 8+" value={s.hotel.tier3} onChange={(v) => setS({ ...s, hotel: { ...s.hotel, tier3: v } })} />
          <NumField id="tm" label="ყოველი სრული 30 ღამე" value={s.hotel.month} onChange={(v) => setS({ ...s, hotel: { ...s.hotel, month: v } })} />
        </div>
      </Card>

      <Card title="ბაღის ფასები (₾)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <NumField id="gs" label="ერთჯერადი" value={s.garden.single} onChange={(v) => setS({ ...s, garden: { ...s.garden, single: v } })} />
          <NumField id="g8" label="8 ვიზიტი" value={s.garden.p8} onChange={(v) => setS({ ...s, garden: { ...s.garden, p8: v } })} />
          <NumField id="g10" label="10 ვიზიტი" value={s.garden.p10} onChange={(v) => setS({ ...s, garden: { ...s.garden, p10: v } })} />
          <NumField id="g12" label="12 ვიზიტი" value={s.garden.p12} onChange={(v) => setS({ ...s, garden: { ...s.garden, p12: v } })} />
          <NumField id="gm" label="1 თვე" value={s.garden.month} onChange={(v) => setS({ ...s, garden: { ...s.garden, month: v } })} />
        </div>
      </Card>

      <Card title="ბიზნესი და ინვოისი">
        <div className="grid gap-x-3 md:grid-cols-2">
          <TextField id="bn" label="სახელი" value={s.business.name} onChange={(v) => setS({ ...s, business: { ...s.business, name: v } })} />
          <TextField id="bp" label="ტელეფონი (ჩანს ჯავშნის გვერდზე)" value={s.business.phone} onChange={(v) => setS({ ...s, business: { ...s.business, phone: v } })} />
          <TextField id="ba" label="მისამართი" value={s.business.address} onChange={(v) => setS({ ...s, business: { ...s.business, address: v } })} />
          <TextField id="bt" label="წესების ბმული (URL)" type="url" value={s.business.termsUrl} onChange={(v) => setS({ ...s, business: { ...s.business, termsUrl: v } })} />
          <TextField id="bb" label="ბანკი" value={s.business.bankName} onChange={(v) => setS({ ...s, business: { ...s.business, bankName: v } })} />
          <TextField id="bi" label="IBAN" value={s.business.iban} onChange={(v) => setS({ ...s, business: { ...s.business, iban: v } })} />
          <TextField id="ba-num" label="ანგარიშის ნომერი" value={s.business.accountNumber ?? ""} onChange={(v) => setS({ ...s, business: { ...s.business, accountNumber: v } })} />
          <TextField id="br" label="ანგარიშის მფლობელი" value={s.business.recipient} onChange={(v) => setS({ ...s, business: { ...s.business, recipient: v } })} />
          <TextField id="be" label="ინვოისის გამგზავნი ელფოსტა" type="email" placeholder="ჯერ არ არის მითითებული" value={s.business.invoiceSenderEmail} onChange={(v) => setS({ ...s, business: { ...s.business, invoiceSenderEmail: v } })} />
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1080px] items-center justify-end gap-3">
          {dirty && <span className="text-xs font-semibold text-gold-ink">შეუნახავი ცვლილებები</span>}
          <Button type="button" variant="outline" disabled={!dirty || pending} onClick={() => setS(initial)}>გაუქმება</Button>
          <Button type="submit" disabled={!dirty || pending} className="bg-terracotta px-5 font-bold text-white hover:bg-[#b85a38]">
            {pending ? <Loader2 className="animate-spin" /> : <Save />} შენახვა
          </Button>
        </div>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-[1.5px] border-sand bg-card p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-extrabold text-forest">{title}</h2>
      {children}
    </section>
  );
}

function NumField({ id, label, value, onChange, step = 0.01 }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="mb-2 space-y-1">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>
      <Input id={id} type="number" min={0} step={step} required value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} className="h-9 bg-card" />
    </div>
  );
}

function TextField({ id, label, value, onChange, type = "text", placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="mb-2 space-y-1">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>
      <Input id={id} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 bg-card" />
    </div>
  );
}
