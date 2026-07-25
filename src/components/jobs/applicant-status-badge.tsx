"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  NEW: "border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)]",
  REVIEWED: "border-[#c7d4e6] bg-[#f2f6fb] text-[#355275]",
  SHORTLISTED: "border-[#b6dfaa] bg-[#e6f6df] text-[#24533b]",
  REJECTED: "border-[#e6b2ad] bg-[#fff0ee] text-[#8a2d25]",
};

export function ApplicantStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-1 text-[11px] font-semibold capitalize",
        statusStyles[status] ?? statusStyles.NEW,
        className,
      )}
    >
      {status === "SHORTLISTED" ? "accepted" : status.toLowerCase()}
    </Badge>
  );
}
