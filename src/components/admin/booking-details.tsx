import { dmy, gel } from "@/lib/domain/format";
import type { Booking } from "@/lib/domain/types";
import { ServiceIcon } from "@/components/brand/service-icon";
import { PACKAGE_KA, SERVICE_KA } from "@/lib/admin/stats";

export function bookingDates(b: Booking): string {
  if (b.service === "HOTEL") return `${dmy(b.checkIn)} → ${dmy(b.checkOut)} · ${b.days.length} ღამე`;
  if (b.days.length === 1) return dmy(b.days[0]);
  return `${dmy(b.days[0])} → ${dmy(b.days[b.days.length - 1])} · ${b.days.length} დღე`;
}

export function ServiceLabel({ b }: { b: Booking }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-sage">
      <ServiceIcon code={b.service} /> {SERVICE_KA[b.service]}
      {b.gardenPackage && b.gardenPackage !== "SINGLE" && <span className="rounded bg-gold-soft px-1.5 py-px text-[10px] text-gold-ink">{PACKAGE_KA[b.gardenPackage]}</span>}
    </span>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-0.5 text-xs">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium break-words whitespace-pre-line">{value}</span>
    </div>
  );
}

const SEX = { male: "ხვადი", female: "ძუ", "": "" } as const;
const YESNO = { yes: "კი", no: "არა", "": "" } as const;
const LANG = { ka: "ქართული", en: "English", uk: "Українська" } as const;

export function BookingDetails({ b }: { b: Booking }) {
  return (
    <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
      <div>
        <p className="mb-1 text-[11px] font-bold tracking-wide text-forest uppercase">🐕 ძაღლი</p>
        <Row label="ასაკი / ჯიში" value={[b.dog.age, b.dog.breed].filter(Boolean).join(" · ")} />
        <Row label="სქესი / სტერილ." value={[SEX[b.dog.sex], YESNO[b.dog.sterilized]].filter(Boolean).join(" · ")} />
        <Row label="აცრები" value={b.dog.vaccines} />
        <Row label="ჭიის წამალი" value={b.dog.deworming} />
        <Row label="ვეტ. კლინიკა" value={`${b.dog.vetClinic} · ${b.dog.vetPhone}`} />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-bold tracking-wide text-forest uppercase">👤 მეპატრონე</p>
        <Row label="ტელეფონი" value={b.owner.phone} />
        <Row label="ელფოსტა" value={b.owner.email} />
        <Row label="საგანგებო კონტაქტი" value={b.owner.emergencyContact} />
        <Row label="მოყვანა / წაყვანა" value={b.arrivalTime ? `${b.arrivalTime} / ${b.departureTime}` : null} />
        <Row label="გასეირნება" value={b.walk ? "კი" : "არა"} />
        <Row label="ფოტოს თანხმობა" value={b.photoConsent ? "კი" : "არა"} />
        <Row label="ენა" value={LANG[b.locale]} />
      </div>
      {b.service === "GARDEN" && b.days.length > 1 && (
        <div className="md:col-span-2">
          <Row label="ვიზიტის დღეები" value={b.days.map(dmy).join(", ")} />
        </div>
      )}
      {b.notes && (
        <div className="mt-1 rounded-lg bg-cream px-3 py-2 text-xs whitespace-pre-line md:col-span-2">📝 {b.notes}</div>
      )}
    </div>
  );
}

export function PriceSummary({ b }: { b: Booking }) {
  return (
    <div className="text-right">
      <div className="text-xl font-extrabold text-forest">{gel(b.total)}</div>
      {b.discountPct > 0 && (
        <div className="text-[11px] text-muted-foreground">
          <s>{gel(b.basePrice)}</s> · −{b.discountPct}%
        </div>
      )}
    </div>
  );
}
