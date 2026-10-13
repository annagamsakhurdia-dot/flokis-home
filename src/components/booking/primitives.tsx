"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function SectionCard({ title, icon, children, className }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mb-3 rounded-2xl border-[1.5px] border-sand bg-card p-5 shadow-soft", className)}>
      <h2 className="mb-3.5 flex items-center gap-2 text-[15px] font-bold text-forest">
        {icon && <span aria-hidden>{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-[#555]">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] font-semibold text-destructive">{error}</p>}
    </div>
  );
}

export const inputClass =
  "h-11 rounded-[10px] border-[1.5px] border-sand bg-cream px-3 text-[15px] md:text-sm focus-visible:border-sage focus-visible:ring-sage/20";

export function Tile({
  on,
  onClick,
  tone = "sage",
  children,
  className,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  tone?: "sage" | "gold";
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-sand bg-card px-2 py-3 text-center text-xs font-bold leading-snug text-muted-foreground transition-colors hover:border-terracotta/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-terracotta/25 disabled:opacity-40",
        on && tone === "sage" && "border-terracotta bg-clay text-forest",
        on && tone === "gold" && "border-terracotta bg-clay text-forest",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatusBox({ tone, children }: { tone: "ok" | "warn" | "no"; children: ReactNode }) {
  return (
    <div
      role={tone === "no" ? "alert" : "status"}
      className={cn(
        "mt-2 flex gap-2 rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-xs font-semibold leading-relaxed",
        tone === "ok" && "border-clay bg-clay/70 text-forest",
        tone === "warn" && "border-terracotta/50 bg-[#f8efe8] text-forest",
        tone === "no" && "border-[#e74c3c] bg-[#fdf0ee] text-[#922b21]",
      )}
    >
      {children}
    </div>
  );
}

export function InfoBox({ tone = "green", children }: { tone?: "green" | "blue"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mb-3 rounded-[10px] border-[1.5px] px-3.5 py-3 text-xs leading-relaxed",
        tone === "green" ? "border-clay bg-clay/70 text-forest" : "border-[#a0b4e0] bg-[#eef0ff] text-[#3a4a8a]",
      )}
    >
      {children}
    </div>
  );
}
