import { BedDouble, Trees } from "lucide-react";
import type { ServiceCode } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function ServiceIcon({ code, className }: { code: ServiceCode; className?: string }) {
  const Icon = code === "HOTEL" ? BedDouble : Trees;
  return <Icon aria-hidden className={cn("inline size-3.5 shrink-0", className)} />;
}
