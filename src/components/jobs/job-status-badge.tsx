"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  ACTIVE: "border-[#b6dfaa] bg-[#e6f6df] text-[#24533b]",
  DRAFT: "border-[#d6dde8] bg-[#f4f6f9] text-[#42526e]",
  PAUSED: "border-[#f5d58a] bg-[#fff6df] text-[#7a4d0b]",
  CLOSED: "border-[#e6b2ad] bg-[#fff0ee] text-[#8a2d25]",
  ARCHIVED: "border-[#d2d7df] bg-[#eef1f5] text-[#52606d]",
};

export function JobStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
        statusStyles[status] ?? statusStyles.DRAFT,
        className,
      )}
    >
      {status.toLowerCase()}
    </Badge>
  );
}
