import Link from "next/link";
import { todayInTbilisi } from "@/lib/domain/dates";
import { dmy, gel } from "@/lib/domain/format";
import { ServiceIcon } from "@/components/brand/service-icon";
import { unpaidBookings } from "@/lib/admin/booking-search";
import { MONTHS_KA, SERVICE_KA, dashboardStats, onDay } from "@/lib/admin/stats";
import { adminBackend } from "@/lib/server/backend";
import { PendingCard } from "@/components/admin/pending-card";
import { UnpaidMoneyList } from "@/components/admin/unpaid-money-list";
import { cn } from "@/lib/utils";

export default async function AdminDashboard() {
  const today = todayInTbilisi();
  const backend = adminBackend();
  const [bookings, settings] = await Promise.all([backend.listBookings(), backend.getSettings()]);
  const stats = dashboardStats(bookings, today);
  const owing = unpaidBookings(bookings);
  const pending = bookings.filter((b) => b.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const arrivals = bookings.filter((b) => b.status === "approved" && b.service === "HOTEL" && b.checkIn === today);
  const departures = bookings.filter((b) => b.status === "approved" && b.service === "HOTEL" && b.checkOut === today);
  const month = MONTHS_KA[Number(today.slice(5, 7)) - 1];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-extrabold text-forest">დღეს, {dmy(today)}</h1>
        {(["HOTEL", "GARDEN"] as const).map((s) => {
          const count = s === "HOTEL" ? stats.hotelToday : stats.gardenToday;
          const cap = settings.services[s].capacity;
          const ratio = cap ? count / cap : 0;
          return (
            <span
              key={s}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border-[1.5px] px-3 py-1 text-xs font-bold",
                ratio >= 1 ? "border-destructive/40 bg-[#fdf0ee] text-[#922b21]" : ratio >= 0.75 ? "border-[#f1c40f] bg-[#fef9e7] text-[#7d6608]" : "border-sage/40 bg-sage-soft text-forest",
              )}
            >
              <ServiceIcon code={s} /> {SERVICE_KA[s]}: {count}/{cap}
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat color="border-l-gold" label="ახალი მოთხოვნა" value={String(stats.pending)} />
        <Stat color="border-l-sage" label="ძაღლი დღეს" value={String(stats.hotelToday + stats.gardenToday)} />
        <Stat color="border-l-info" label={`შემოსავალი · ${month}`} value={gel(stats.monthRevenue)} sub={`წელი: ${gel(stats.yearRevenue)}`} />
        <Stat color="border-l-destructive" label="გადაუხდელი" value={gel(stats.unpaid)} sub={`მიღებული: ${gel(stats.received)}`} href="#unpaid" />
      </div>

      <UnpaidMoneyList bookings={owing} today={today} />

      <section className="rounded-2xl border border-clay bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-forest">
          მოლოდინში მყოფი მოთხოვნები
          <span className="rounded-full bg-terracotta px-2 py-px text-xs text-white">{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground">ახალი მოთხოვნები არ არის. 🎉</p>
        ) : (
          <div className="space-y-3">
            {pending.map((b) => (
              <PendingCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <DayList title="დღეს შემოდის" items={arrivals.map((b) => `${b.dog.name} · ${b.arrivalTime} · ${b.owner.fullName}`)} />
        <DayList title="დღეს გადის" items={departures.map((b) => `${b.dog.name} · ${b.departureTime} · ${b.owner.fullName}`)} />
        <DayList title="ბაღი დღეს" items={onDay(bookings, today, "GARDEN").map((b) => `${b.dog.name} · ${b.arrivalTime}–${b.departureTime}`)} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/admin/calendar" className="font-semibold text-sage underline">სრული კალენდარი →</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, sub, color, href }: { label: string; value: string; sub?: string; color: string; href?: string }) {
  const body = (
    <>
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-forest">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </>
  );
  const className = cn("rounded-2xl border-[1.5px] border-l-4 border-sand bg-card p-4 shadow-soft", color, href && "block hover:bg-cream");
  if (href) return <Link href={href} className={className}>{body}</Link>;
  return <div className={className}>{body}</div>;
}

function DayList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-sand bg-card p-4 shadow-soft">
      <h3 className="mb-2 text-sm font-bold text-forest">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">არავინ</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
