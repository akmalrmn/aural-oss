"use client";

import {
  Archive,
  Check,
  Copy,
  Link2,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SkilioPanel } from "@/components/jobs/skilio-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";

type SourceLink = {
  id: string;
  name: string;
  channel: string;
  trackingCode: string;
  archivedAt: string | null;
  publicApplicationUrl: string;
};

type SourceMetric = {
  sourceLinkId: string | null;
  name: string;
  channel: string;
  trackingCode: string | null;
  archivedAt: string | null;
  visits: number;
  started: number;
  submitted: number;
  accepted: number;
  conversionRate: number | null;
};

type SourceAttribution = {
  totalVisits: number;
  totalStarted: number;
  totalAttributedApplications: number;
  sources: SourceMetric[];
};

function channelLabel(channel: string) {
  if (
    channel === "JOBSTREET" ||
    channel === "LINKEDIN" ||
    channel === "INDEED"
  ) {
    return "Preset link";
  }
  if (channel === "DIRECT") return "Canonical link";
  return "Custom source";
}

function MetricValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[var(--skilio-ink-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--skilio-ink)]">
        {value}
      </div>
    </div>
  );
}

export function SourceAttributionPanel({
  jobId,
  directApplicationUrl,
  sourceLinks,
  attribution,
}: {
  jobId: string;
  directApplicationUrl: string;
  sourceLinks: SourceLink[];
  attribution: SourceAttribution;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [adding, setAdding] = useState(false);
  const [sourceName, setSourceName] = useState("");

  const createLink = trpc.job.createSourceLink.useMutation({
    onSuccess: async () => {
      setSourceName("");
      setAdding(false);
      await utils.job.getById.invalidate({ id: jobId });
      toast({ title: "Source link created" });
    },
    onError: (error) => {
      toast({
        title: "Source link was not created",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const setArchived = trpc.job.setSourceLinkArchived.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.job.getById.invalidate({ id: jobId });
      toast({
        title: variables.archived
          ? "Source link archived"
          : "Source link reactivated",
      });
    },
    onError: (error) => {
      toast({
        title: "Source link was not updated",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const urlBySource = useMemo(
    () =>
      new Map(
        sourceLinks.map((link) => [link.id, link.publicApplicationUrl]),
      ),
    [sourceLinks],
  );

  async function copySourceLink(source: SourceMetric) {
    const url = source.sourceLinkId
      ? urlBySource.get(source.sourceLinkId)
      : directApplicationUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast({ title: `${source.name} link copied` });
  }

  function submitCustomSource() {
    const name = sourceName.trim();
    if (!name) return;
    createLink.mutate({ jobId, name });
  }

  return (
    <SkilioPanel data-testid="source-attribution-panel">
      <div className="flex flex-col gap-4 border-b border-[var(--skilio-border)] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[var(--skilio-brand)]" />
            <h2 className="text-lg font-semibold text-[var(--skilio-ink)]">
              Source performance
            </h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
            First-touch attribution from each hiring channel through submission.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden gap-5 sm:flex">
            <MetricValue label="Tracked visits" value={attribution.totalVisits} />
            <MetricValue
              label="Applications"
              value={attribution.totalAttributedApplications}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdding((current) => !current)}
            className="gap-2 border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
          >
            {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {adding ? "Cancel" : "Add source"}
          </Button>
        </div>
      </div>

      {adding && (
        <div className="border-b border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-5">
          <div className="grid max-w-2xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="custom-source-name">Source name</Label>
              <Input
                id="custom-source-name"
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitCustomSource();
                }}
                placeholder="Example: Design community newsletter"
                maxLength={80}
                className="border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink)] focus-visible:ring-[var(--skilio-brand)]"
              />
            </div>
            <Button
              type="button"
              onClick={submitCustomSource}
              disabled={!sourceName.trim() || createLink.isLoading}
              className="gap-2 bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
            >
              <Check className="h-4 w-4" />
              Create link
            </Button>
          </div>
        </div>
      )}

      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--skilio-border)] hover:bg-transparent">
              <TableHead className="pl-5">Source</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Started</TableHead>
              <TableHead className="text-right">Applied</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead className="text-right">Accepted</TableHead>
              <TableHead className="w-28 pr-5 text-right">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attribution.sources.map((source) => (
              <TableRow
                key={source.sourceLinkId ?? "direct"}
                className="border-[var(--skilio-border)]"
              >
                <TableCell className="pl-5">
                  <div className="font-medium text-[var(--skilio-ink)]">
                    {source.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--skilio-ink-muted)]">
                    <span>{channelLabel(source.channel)}</span>
                    {source.archivedAt && (
                      <Badge
                        variant="outline"
                        className="h-5 rounded-md border-[var(--skilio-border-strong)] px-1.5 text-[10px] text-[var(--skilio-ink-muted)]"
                      >
                        Archived
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {source.visits}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {source.started}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {source.submitted}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {source.conversionRate === null
                    ? "—"
                    : `${source.conversionRate}%`}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {source.accepted}
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    {!source.archivedAt && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => copySourceLink(source)}
                        className="h-9 w-9 text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)]"
                        aria-label={`Copy ${source.name} link`}
                        title={`Copy ${source.name} link`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {source.channel === "CUSTOM" && source.sourceLinkId && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setArchived.mutate({
                            id: source.sourceLinkId!,
                            archived: !source.archivedAt,
                          })
                        }
                        disabled={setArchived.isLoading}
                        className="h-9 w-9 text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)]"
                        aria-label={
                          source.archivedAt
                            ? `Reactivate ${source.name} link`
                            : `Archive ${source.name} link`
                        }
                        title={
                          source.archivedAt
                            ? `Reactivate ${source.name}`
                            : `Archive ${source.name}`
                        }
                      >
                        {source.archivedAt ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-[var(--skilio-border)] lg:hidden">
        {attribution.sources.map((source) => (
          <article
            key={source.sourceLinkId ?? "direct"}
            className="space-y-4 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-[var(--skilio-ink)]">
                  {source.name}
                </div>
                <div className="mt-1 text-xs text-[var(--skilio-ink-muted)]">
                  {channelLabel(source.channel)}
                  {source.archivedAt ? " · Archived" : ""}
                </div>
              </div>
              {!source.archivedAt && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => copySourceLink(source)}
                  className="h-10 w-10 shrink-0 border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)]"
                  aria-label={`Copy ${source.name} link`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MetricValue label="Visits" value={source.visits} />
              <MetricValue label="Started" value={source.started} />
              <MetricValue label="Applied" value={source.submitted} />
              <MetricValue
                label="Conversion"
                value={
                  source.conversionRate === null
                    ? "—"
                    : `${source.conversionRate}%`
                }
              />
              <MetricValue label="Accepted" value={source.accepted} />
            </div>
            {source.channel === "CUSTOM" && source.sourceLinkId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setArchived.mutate({
                    id: source.sourceLinkId!,
                    archived: !source.archivedAt,
                  })
                }
                disabled={setArchived.isLoading}
                className="h-9 gap-2 px-0 text-[var(--skilio-ink-soft)] hover:bg-transparent hover:text-[var(--skilio-brand)]"
              >
                {source.archivedAt ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {source.archivedAt ? "Reactivate link" : "Archive link"}
              </Button>
            )}
          </article>
        ))}
      </div>
    </SkilioPanel>
  );
}
