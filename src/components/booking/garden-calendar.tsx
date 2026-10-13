"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, daysInMonth, diffDays, monthKey, shiftMonth, weekdayMondayFirst } from "@/lib/domain/dates";
import type { DayAvailability } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { availabilityAction } from "@/app/[locale]/actions";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  t: Dictionary;
  today: string;
  selected: string[];
  /** null = unlimited within the month window */
  maxDays: number | null;
  windowDays: number;
  onChange: (days: string[]) => void;
}

export function GardenCalendar({ t, today, selected, maxDays, windowDays, onChange }: Props) {
  const [month, setMonth] = useState(monthKey(selected[0] ?? today));
  const [byMonth, setByMonth] = useState<Record<string, Record<string, DayAvailability> | "error">>({});
  const minMonth = monthKey(today);
  const maxMonth = monthKey(addDays(today, 365));
  const loaded = byMonth[month];
  const avail = loaded && loaded !== "error" ? loaded : null;
  const loadError = loaded === "error";

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    const days = daysInMonth(month);
    availabilityAction("GARDEN", days[0], days[days.length - 1])
      .then((rows) => {
        if (!cancelled) setByMonth((prev) => ({ ...prev, [month]: Object.fromEntries(rows.map((r) => [r.date, r])) }));
      })
      .catch(() => !cancelled && setByMonth((prev) => ({ ...prev, [month]: "error" })));
    return () => {
      cancelled = true;
    };
  }, [month, loaded]);

  const days = daysInMonth(month);
  const lead = weekdayMondayFirst(days[0]);
  const [y, m] = month.split("-").map(Number);
  const first = selected[0];

  function toggle(day: string) {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
      return;
    }
    if (maxDays === 1) {
      onChange([day]);
      return;
    }
    if (maxDays !== null && selected.length >= maxDays) return;
    onChange([...selected, day].sort());
  }

  return (
    <div className="mb-2.5 rounded-2xl bg-cream p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= minMonth}
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="rounded-lg border-[1.5px] border-sand bg-card px-3 py-1 disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-sm font-bold text-forest">
          {t.months[m - 1]} {y}
        </div>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= maxMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="rounded-lg border-[1.5px] border-sand bg-card px-3 py-1 disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {t.weekdays.map((w) => (
          <div key={w} className="py-0.5 text-center text-[10px] font-bold text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      {loadError ? (
        <p className="py-6 text-center text-xs font-semibold text-destructive">{t.errors.network}</p>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`e${i}`} />
          ))}
          {days.map((day) => {
            const a = avail?.[day];
            const isPast = day < today;
            const isSel = selected.includes(day);
            const isFull = !!a && a.booked >= a.capacity;
            const isPartial = !!a && a.booked > 0 && !isFull;
            const outOfWindow = maxDays === null && first && !isSel && (diffDays(first, day) >= windowDays || day < first);
            const limitReached = maxDays !== null && maxDays > 1 && selected.length >= maxDays && !isSel;
            const disabled = isPast || (isFull && !isSel) || !!outOfWindow || limitReached || !avail;
            if (!avail && !isPast) return <Skeleton key={day} className="h-10 rounded-[7px]" />;
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                aria-pressed={isSel}
                aria-label={day}
                onClick={() => toggle(day)}
                className={cn(
                  "flex min-h-10 flex-col items-center justify-center rounded-[7px] border-2 border-transparent bg-card text-xs font-bold transition-colors",
                  isPast && "bg-[#f0f0f0] text-[#ccc]",
                  isPartial && !isSel && "border-[#e67e22] bg-[#fff5e6]",
                  isFull && !isSel && "border-[#f0c4be] bg-[#fdf0ee] text-[#ccc]",
                  (outOfWindow || limitReached) && !isPast && !isFull && "opacity-40",
                  isSel && "border-sage bg-sage text-white",
                  !disabled && !isSel && "hover:border-sage/60",
                )}
              >
                {Number(day.slice(8))}
                {a && !isPast && (
                  <span className={cn("mt-px rounded-lg px-1 text-[9px] font-bold", isSel ? "bg-white/20" : "bg-black/5 text-muted-foreground")}>
                    {a.booked}/{a.capacity}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <Legend color="bg-sage" label={t.legendSelected} />
        <Legend color="bg-[#e67e22]" label={t.legendPartial} />
        <Legend color="bg-[#eee] border border-[#ccc]" label={t.legendFull} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("inline-block size-2.5 rounded-[3px]", color)} />
      {label}
    </span>
  );
}
