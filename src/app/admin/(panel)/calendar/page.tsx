import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { daysInMonth, isIsoDate, monthKey, shiftMonth, todayInTbilisi, weekdayMondayFirst } from "@/lib/domain/dates";
import type { Booking, ServiceCode } from "@/lib/domain/types";
import { ServiceIcon } from "@/components/brand/service-icon";
import { MONTHS_KA, SERVICE_KA, WEEKDAYS_KA, onDay, revenueForPeriod } from "@/lib/admin/stats";
import { dmy, gel } from "@/lib/domain/format";
import { adminBackend } from "@/lib/server/backend";
import { cn } from "@/lib/utils";

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const sp = await searchParams;
  const today = todayInTbilisi();
  const monthParam = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthKey(today);
  const dayParam = typeof sp.day === "string" && isIsoDate(sp.day) ? sp.day : monthParam === monthKey(today) ? today : `${monthParam}-01`;

  const backend = adminBackend();
  const [bookings, settings] = await Promise.all([backend.listBookings(), backend.getSettings()]);
  const days = daysInMonth(monthParam);
  const lead = weekdayMondayFirst(days[0]);
  const [y, m] = monthParam.split("-").map(Number);
  const services = ["HOTEL", "GARDEN"] as const;

  const count = (day: string, s: ServiceCode) => onDay(bookings, day, s).length;
  const pendingCount = (day: string) => onDay(bookings, day, undefined, ["pending"]).length;
  const link = (params: { month?: string; day?: string }) =>
    `/admin/calendar?${new URLSearchParams({ month: params.month ?? monthParam, ...(params.day ? { day: params.day } : {}) })}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border-[1.5px] border-sand bg-card p-3 shadow-soft sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link href={link({ month: shiftMonth(monthParam, -1) })} aria-label="წინა თვე" className="rounded-lg border-[1.5px] border-sand px-3 py-1.5 hover:bg-cream">
            <ChevronLeft className="size-4" />
          </Link>
          <div className="text-center">
            <h1 className="text-base font-extrabold text-forest">{MONTHS_KA[m - 1]} {y}</h1>
            <p className="text-[11px] text-muted-foreground">შემოსავალი: {gel(revenueForPeriod(bookings, monthParam))}</p>
          </div>
          <Link href={link({ month: shiftMonth(monthParam, 1) })} aria-label="შემდეგი თვე" className="rounded-lg border-[1.5px] border-sand px-3 py-1.5 hover:bg-cream">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS_KA.map((w) => (
            <div key={w} className="text-center text-[11px] font-bold text-muted-foreground">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => <div key={i} />)}
          {days.map((day) => {
            const hotel = count(day, "HOTEL");
            const hotelCap = settings.services.HOTEL.capacity;
            const load = hotelCap ? hotel / hotelCap : 0;
            const pend = pendingCount(day);
            return (
              <Link
                key={day}
                href={link({ day })}
                aria-current={day === dayParam ? "date" : undefined}
                className={cn(
                  "flex min-h-16 flex-col rounded-lg border-2 p-1 text-left transition-colors sm:min-h-20 sm:p-1.5",
                  day === dayParam ? "border-forest" : "border-transparent hover:border-sage/50",
                  load >= 1 ? "bg-[#fdf0ee]" : load >= 0.75 ? "bg-[#fff5e6]" : "bg-cream",
                  day < today && "opacity-60",
                )}
              >
                <span className={cn("text-xs font-bold", day === today && "w-fit rounded bg-forest px-1 text-white")}>{Number(day.slice(8))}</span>
                <span className="mt-auto space-y-px text-[10px] leading-tight font-semibold sm:text-[11px]">
                  {hotel > 0 && <span className="flex items-center gap-0.5 text-forest"><ServiceIcon code="HOTEL" className="size-2.5" /> {hotel}<span className="hidden text-muted-foreground sm:inline">/{hotelCap}</span></span>}
                  {count(day, "GARDEN") > 0 && <span className="flex items-center gap-0.5 text-terracotta"><ServiceIcon code="GARDEN" className="size-2.5" /> {count(day, "GARDEN")}</span>}
                  {pend > 0 && <span className="block text-terracotta">{pend}</span>}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">რიცხვები — დადასტურებული ჯავშნები. ტერაკოტის რიცხვი მოლოდინშია და ადგილსაც იკავებს.</p>
      </section>

      <DayPanel day={dayParam} bookings={bookings} capacity={Object.fromEntries(services.map((s) => [s, settings.services[s].capacity])) as Record<ServiceCode, number>} />
    </div>
  );
}

function DayPanel({ day, bookings, capacity }: { day: string; bookings: Booking[]; capacity: Record<ServiceCode, number> }) {
  const services = ["HOTEL", "GARDEN"] as const;
  const arrivals = bookings.filter((b) => b.status === "approved" && b.service === "HOTEL" && b.checkIn === day).sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime));
  const departures = bookings.filter((b) => b.status === "approved" && b.service === "HOTEL" && b.checkOut === day).sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  const pending = onDay(bookings, day, undefined, ["pending"]);

  return (
    <aside className="space-y-3">
      <div className="rounded-2xl border-[1.5px] border-sand bg-card p-4 shadow-soft">
        <h2 className="mb-2 text-base font-extrabold text-forest">{dmy(day)}</h2>
        {services.map((s) => {
          const list = onDay(bookings, day, s);
          return (
            <div key={s} className="mb-2.5">
              <p className="mb-1 text-xs font-bold">
                <ServiceIcon code={s} /> {SERVICE_KA[s]} <span className="text-muted-foreground">· {list.length}/{capacity[s]}</span>
              </p>
              {list.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-0.5 text-xs">
                  {list.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span className="font-semibold">{b.dog.name} <span className="font-normal text-muted-foreground">{b.dog.breed}</span></span>
                      <span className="shrink-0 text-muted-foreground">{b.owner.phone}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <MiniList title="🛬 შემოსვლა" items={arrivals.map((b) => `${b.arrivalTime || "—"} · ${b.dog.name}`)} />
        <MiniList title="🛫 გასვლა" items={departures.map((b) => `${b.departureTime || "—"} · ${b.dog.name}`)} />
      </div>
      {pending.length > 0 && <MiniList title="მოლოდინში" items={pending.map((b) => `${b.dog.name} · ${b.owner.fullName}`)} />}
    </aside>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-sand bg-card p-4 shadow-soft">
      <h3 className="mb-1.5 text-sm font-bold text-forest">{title}</h3>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">არავინ</p> : (
        <ul className="space-y-0.5 text-xs">{items.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
      )}
    </div>
  );
}
