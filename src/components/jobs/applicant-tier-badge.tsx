"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const APPLICANT_REVIEW_TIERS = [
  {
    value: "TIER_1",
    label: "Tier 1",
    description: "Priority candidate",
  },
  {
    value: "TIER_2",
    label: "Tier 2",
    description: "Strong candidate",
  },
  {
    value: "TIER_3",
    label: "Tier 3",
    description: "Candidate to consider",
  },
  {
    value: "TIER_4",
    label: "Tier 4",
    description: "Lower-priority candidate",
  },
  {
    value: "TIER_5",
    label: "Tier 5",
    description: "Lowest-priority candidate",
  },
] as const;

export type ApplicantReviewTier =
  (typeof APPLICANT_REVIEW_TIERS)[number]["value"];

const tierStyles: Record<ApplicantReviewTier, string> = {
  TIER_1:
    "border-[#b6dfaa] bg-[#e6f6df] text-[var(--skilio-brand-strong)]",
  TIER_2:
    "border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink)]",
  TIER_3:
    "border-[var(--skilio-border)] bg-[var(--skilio-panel)] text-[var(--skilio-ink-soft)]",
  TIER_4:
    "border-[var(--skilio-border)] bg-transparent text-[var(--skilio-ink-soft)]",
  TIER_5:
    "border-[var(--skilio-border)] bg-transparent text-[var(--skilio-ink-muted)]",
};

export function ApplicantTierBadge({
  tier,
  className,
  showUnranked = false,
}: {
  tier?: string | null;
  className?: string;
  showUnranked?: boolean;
}) {
  const option = APPLICANT_REVIEW_TIERS.find((item) => item.value === tier);

  if (!option) {
    return showUnranked ? (
      <Badge
        variant="outline"
        className={cn(
          "rounded-md border-[var(--skilio-border)] bg-transparent px-2 py-1 text-[11px] font-medium text-[var(--skilio-ink-muted)]",
          className,
        )}
      >
        Unranked
      </Badge>
    ) : (
      <span className={cn("text-sm text-[var(--skilio-ink-muted)]", className)}>
        —
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      title={option.description}
      className={cn(
        "rounded-md px-2 py-1 text-[11px] font-semibold",
        tierStyles[option.value],
        className,
      )}
    >
      {option.label}
    </Badge>
  );
}
