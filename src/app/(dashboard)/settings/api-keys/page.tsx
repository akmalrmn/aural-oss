"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SkilioPanel } from "@/components/jobs/skilio-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";
import {
  Ban,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function keyStatus(row: {
  isActive: boolean;
  expiresAt: string | null;
}) {
  if (!row.isActive) {
    return {
      label: "Revoked",
      className: "bg-[var(--skilio-control)] text-[var(--skilio-ink-muted)]",
    };
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    return {
      label: "Expired",
      className: "bg-[var(--skilio-danger-soft)] text-[var(--skilio-danger)]",
    };
  }

  return {
    label: "Active",
    className:
      "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]",
  };
}

export default function ApiKeysSettingsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const listQuery = trpc.apiKey.list.useQuery();

  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      setRevealedKey(data.key);
      setName("");
      setExpiresLocal("");
      void utils.apiKey.list.invalidate();
      toast({ title: "API key created" });
    },
    onError: (error) => {
      toast({
        title: "Unable to create API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revokeMutation = trpc.apiKey.revoke.useMutation({
    onSuccess: () => {
      void utils.apiKey.list.invalidate();
      toast({ title: "API key revoked" });
    },
    onError: (error) => {
      toast({
        title: "Unable to revoke API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = trpc.apiKey.delete.useMutation({
    onSuccess: () => {
      void utils.apiKey.list.invalidate();
      toast({ title: "API key deleted" });
    },
    onError: (error) => {
      toast({
        title: "Unable to delete API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({
        title: "Could not copy the API key",
        description: "Select the key and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const expiresAt = expiresLocal ? new Date(expiresLocal) : null;
  const expiryIsInvalid = Boolean(
    expiresAt &&
      (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()),
  );
  const keys = listQuery.data ?? [];

  return (
    <div className="space-y-5">
      <SkilioPanel>
        <div className="flex items-start gap-3 border-b border-[var(--skilio-border)] px-5 py-5 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--skilio-ink)]">
              Developer access
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
              Create credentials for integrations that use the Skilio Hiring API.
              {" "}
              <Link
                href="/docs/developer-api"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--skilio-brand-strong)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)]"
              >
                View API docs
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>

        <form
          className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6"
          aria-busy={createMutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (expiryIsInvalid) return;
            createMutation.mutate({
              name: name.trim(),
              ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="keyName">Key name</Label>
            <Input
              id="keyName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Production integration"
              autoComplete="off"
              maxLength={80}
              disabled={createMutation.isPending}
              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-control)]"
            />
            <p className="text-xs leading-5 text-[var(--skilio-ink-muted)]">
              Use a name that identifies where this key is used.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyExpires">Expiration (optional)</Label>
            <Input
              id="keyExpires"
              type="datetime-local"
              value={expiresLocal}
              onChange={(event) => setExpiresLocal(event.target.value)}
              disabled={createMutation.isPending}
              aria-invalid={expiryIsInvalid}
              aria-describedby="keyExpiresHelp"
              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-control)]"
            />
            <p
              id="keyExpiresHelp"
              className={
                expiryIsInvalid
                  ? "text-xs leading-5 text-[var(--skilio-danger)]"
                  : "text-xs leading-5 text-[var(--skilio-ink-muted)]"
              }
            >
              {expiryIsInvalid
                ? "Choose a date and time in the future."
                : "Leave blank for a key that does not expire automatically."}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--skilio-border)] pt-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex max-w-xl items-start gap-2 text-xs leading-5 text-[var(--skilio-ink-muted)]">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--skilio-brand)]"
                aria-hidden="true"
              />
              The complete secret is shown once. Store it in your password manager
              or secrets vault before closing the confirmation.
            </p>
            <Button
              type="submit"
              disabled={
                createMutation.isPending || !name.trim() || expiryIsInvalid
              }
              className="shrink-0 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98]"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {createMutation.isPending ? "Creating…" : "Create API key"}
            </Button>
          </div>
        </form>
      </SkilioPanel>

      <Dialog
        open={revealedKey !== null}
        onOpenChange={(open) => {
          if (!open) setRevealedKey(null);
        }}
      >
        <DialogContent className="skilio-interface w-[calc(100%-2rem)] rounded-[var(--skilio-radius-lg)] border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-2)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Save your API key</DialogTitle>
            <DialogDescription className="leading-6 text-[var(--skilio-ink-soft)]">
              This is the only time the complete secret is shown. Copy it now and
              store it somewhere safe.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] p-3 font-mono text-sm leading-6 text-[var(--skilio-ink)] break-all">
            {revealedKey}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => revealedKey && copyKey(revealedKey)}
              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy key
            </Button>
            <Button
              type="button"
              onClick={() => setRevealedKey(null)}
              className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
            >
              I&apos;ve saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SkilioPanel>
        <div className="flex items-start gap-3 border-b border-[var(--skilio-border)] px-5 py-5 sm:items-center sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--skilio-ink)]">
              Your API keys
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
              Revoke a key to stop access immediately, or delete its record when
              you no longer need it.
            </p>
          </div>
          {!listQuery.isLoading && !listQuery.isError && (
            <span className="shrink-0 rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] px-2.5 py-1.5 text-xs font-medium tabular-nums text-[var(--skilio-ink-soft)]">
              {keys.length} {keys.length === 1 ? "key" : "keys"}
            </span>
          )}
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-px bg-[var(--skilio-border)]" role="status">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="grid min-h-20 animate-pulse gap-3 bg-[var(--skilio-elevated)] px-5 py-4 sm:px-6 md:grid-cols-[1fr_1fr_100px_1fr] md:items-center"
              >
                <div className="h-3 w-36 rounded bg-[var(--skilio-control)]" />
                <div className="h-3 w-44 max-w-full rounded bg-[var(--skilio-control)]" />
                <div className="h-7 w-16 rounded bg-[var(--skilio-control)]" />
                <div className="h-3 w-28 rounded bg-[var(--skilio-control)]" />
              </div>
            ))}
            <span className="sr-only">Loading API keys</span>
          </div>
        ) : listQuery.isError ? (
          <div className="px-6 py-12 text-center">
            <h3 className="text-base font-semibold text-[var(--skilio-ink)]">
              API keys could not be loaded
            </h3>
            <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
              Check your connection and try again.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void listQuery.refetch()}
              className="mt-4 border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : keys.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <KeyRound
              className="mx-auto h-6 w-6 text-[var(--skilio-ink-muted)]"
              aria-hidden="true"
            />
            <h3 className="mt-3 text-base font-semibold text-[var(--skilio-ink)]">
              No API keys yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--skilio-ink-soft)]">
              Create a named key above when you are ready to connect an
              integration.
            </p>
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(150px,1fr)_minmax(180px,1fr)_100px_140px_140px_88px] gap-4 border-b border-[var(--skilio-border)] bg-[var(--skilio-panel)] px-6 py-3 text-xs font-semibold text-[var(--skilio-ink-muted)] md:grid">
              <span>Name</span>
              <span>Key</span>
              <span>Status</span>
              <span>Last used</span>
              <span>Expires</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y divide-[var(--skilio-border)]">
              {keys.map((row) => {
                const status = keyStatus(row);
                const isRevoking =
                  revokeMutation.isPending &&
                  revokeMutation.variables?.id === row.id;
                const isDeleting =
                  deleteMutation.isPending &&
                  deleteMutation.variables?.id === row.id;

                return (
                  <li
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-4 px-5 py-4 transition-colors hover:bg-[var(--skilio-panel)] sm:px-6 md:grid-cols-[minmax(150px,1fr)_minmax(180px,1fr)_100px_140px_140px_88px] md:items-center md:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--skilio-ink)]">
                        {row.name}
                      </p>
                      <code className="mt-1 block truncate text-xs text-[var(--skilio-ink-muted)] md:hidden">
                        {row.maskedKey}
                      </code>
                    </div>
                    <code className="hidden truncate text-xs text-[var(--skilio-ink-soft)] md:block">
                      {row.maskedKey}
                    </code>
                    <span
                      className={`inline-flex min-h-7 items-center justify-self-end rounded-[var(--skilio-radius-sm)] px-2.5 text-xs font-semibold md:justify-self-start ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <p className="text-xs tabular-nums text-[var(--skilio-ink-muted)] md:text-sm">
                      <span className="font-medium text-[var(--skilio-ink-soft)] md:hidden">
                        Last used: {" "}
                      </span>
                      {formatDate(row.lastUsedAt, "Never")}
                    </p>
                    <p className="text-xs tabular-nums text-[var(--skilio-ink-muted)] md:text-sm">
                      <span className="font-medium text-[var(--skilio-ink-soft)] md:hidden">
                        Expires: {" "}
                      </span>
                      {formatDate(row.expiresAt, "Never")}
                    </p>
                    <div className="col-start-2 row-start-2 row-span-2 flex items-end justify-end gap-1 self-end md:col-auto md:row-auto md:self-auto">
                      {row.isActive && status.label !== "Expired" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Revoke ${row.name}`}
                              title={`Revoke ${row.name}`}
                              disabled={isRevoking}
                              className="h-10 w-10 text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-ink)] md:h-9 md:w-9"
                            >
                              {isRevoking ? (
                                <Loader2
                                  className="h-4 w-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Ban className="h-4 w-4" aria-hidden="true" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="skilio-interface border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)]">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Revoke &quot;{row.name}&quot;?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-[var(--skilio-ink-soft)]">
                                Requests using this key will fail immediately. You
                                can delete the record later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  revokeMutation.mutate({ id: row.id })
                                }
                                disabled={revokeMutation.isPending}
                                className="bg-[var(--skilio-ink)] text-white hover:bg-[var(--skilio-ink)]/90"
                              >
                                Revoke key
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${row.name}`}
                            title={`Delete ${row.name}`}
                            disabled={isDeleting}
                            className="h-10 w-10 text-[var(--skilio-danger)] hover:bg-[var(--skilio-danger-soft)] hover:text-[var(--skilio-danger)] md:h-9 md:w-9"
                          >
                            {isDeleting ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="skilio-interface border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete &quot;{row.name}&quot;?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-[var(--skilio-ink-soft)]">
                              This removes the key record permanently. Any request
                              using this secret will fail.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-[var(--skilio-danger)] text-white hover:bg-[var(--skilio-danger)]/90"
                              onClick={() =>
                                deleteMutation.mutate({ id: row.id })
                              }
                              disabled={deleteMutation.isPending}
                            >
                              Delete key
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SkilioPanel>
    </div>
  );
}
