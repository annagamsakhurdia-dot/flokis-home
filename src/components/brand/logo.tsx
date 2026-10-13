import { cn } from "@/lib/utils";

export function Logo({ className, name = "ფლოკის სახლი" }: { className?: string; name?: string }) {
  return (
    <span className={cn("font-logo font-extrabold tracking-[0.02em]", className)}>
      {name}
    </span>
  );
}
