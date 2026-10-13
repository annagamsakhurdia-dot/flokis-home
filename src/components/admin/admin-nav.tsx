"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Mail, PawPrint, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "მიმოხილვა", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "ჯავშნები", icon: PawPrint },
  { href: "/admin/calendar", label: "კალენდარი", icon: CalendarDays },
  { href: "/admin/settings", label: "პარამეტრები", icon: Settings },
];

export function AdminNav({ showOutbox }: { showOutbox: boolean }) {
  const pathname = usePathname();
  const items = showOutbox ? [...ITEMS, { href: "/admin/outbox", label: "ელფოსტა", icon: Mail }] : ITEMS;
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="ადმინის ნავიგაცია">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-t-xl px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
              active ? "bg-background text-forest" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            <item.icon aria-hidden className="mr-1 inline size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
