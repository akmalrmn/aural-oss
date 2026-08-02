"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useProject } from "@/components/project-provider";
import { useOrg } from "@/components/org-provider";
import { SkilioPanel } from "@/components/jobs/skilio-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, LockKeyhole, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProjectSettingsGeneralPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { currentProject } = useProject();
  const { currentOrg } = useOrg();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (currentProject) {
      setName(currentProject.name);
      setDescription(currentProject.description ?? "");
    }
  }, [currentProject]);

  const updateMutation = trpc.project.update.useMutation({
    onSuccess: () => {
      toast({ title: "Workspace updated" });
      utils.project.list.invalidate();
      utils.project.getById.invalidate();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Workspace deleted" });
      utils.project.list.invalidate();
      router.push("/dashboard");
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!currentProject) {
    return (
      <SkilioPanel className="px-6 py-12 text-center">
        <Building2
          className="mx-auto h-6 w-6 text-[var(--skilio-ink-muted)]"
          aria-hidden="true"
        />
        <h2 className="mt-3 text-lg font-semibold text-[var(--skilio-ink)]">
          No workspace selected
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--skilio-ink-soft)]">
          Select a hiring workspace before changing its name or description.
        </p>
      </SkilioPanel>
    );
  }

  const isAdmin = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN";
  const isDirty =
    name.trim() !== currentProject.name ||
    description.trim() !== (currentProject.description ?? "");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <SkilioPanel>
        <div className="flex items-start gap-3 border-b border-[var(--skilio-border)] px-5 py-5 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--skilio-ink)]">
              Workspace identity
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
              This hiring workspace is currently named &quot;{currentProject.name}&quot;.
            </p>
          </div>
        </div>

        <form
          className="space-y-5 px-5 py-5 sm:px-6 sm:py-6"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate({
              id: currentProject.id,
              name: name.trim(),
              description: description.trim() || undefined,
            });
          }}
          aria-busy={updateMutation.isPending}
        >
          {!isAdmin && (
            <div className="flex gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] p-4 text-sm text-[var(--skilio-ink-soft)]">
              <LockKeyhole
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--skilio-brand-strong)]"
                aria-hidden="true"
              />
              <p className="leading-6">
                Only workspace owners and admins can edit these details.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="projectName">Workspace name</Label>
            <Input
              id="projectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              autoComplete="organization"
              maxLength={80}
              className="h-10 border-[var(--skilio-border-strong)] bg-[var(--skilio-control)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectDesc">Hiring note (optional)</Label>
            <Textarea
              id="projectDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe this hiring workspace..."
              disabled={!isAdmin}
              maxLength={280}
              className="min-h-32 resize-y border-[var(--skilio-border-strong)] bg-[var(--skilio-control)]"
            />
            <p className="text-xs leading-5 text-[var(--skilio-ink-muted)]">
              Give teammates a concise note about the roles or hiring work managed here.
            </p>
          </div>
          {isAdmin && (
            <div className="flex justify-end border-t border-[var(--skilio-border)] pt-5">
              <Button
                type="submit"
                className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98]"
                disabled={
                  updateMutation.isPending || !name.trim() || !isDirty
                }
              >
                {updateMutation.isPending && (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {!updateMutation.isPending && (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </form>
      </SkilioPanel>

      {isAdmin && (
        <SkilioPanel className="border-[color:var(--skilio-danger)]/20 bg-[var(--skilio-danger-soft)]">
          <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-white text-[var(--skilio-danger)]">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[var(--skilio-ink)]">
                Delete workspace
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                Permanently delete this workspace. Existing job openings and applications will lose this workspace assignment.
              </p>
            </div>
          </div>
          <div className="border-t border-[color:var(--skilio-danger)]/15 px-5 py-4 sm:px-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-danger)] sm:w-auto"
                >
                  Delete workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="skilio-interface border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)]">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &quot;{currentProject.name}&quot;?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[var(--skilio-ink-soft)]">
                    This action is irreversible. Job openings and applications in this workspace will lose their workspace assignment.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-[var(--skilio-danger)] text-white hover:bg-[var(--skilio-danger)]/90"
                    onClick={() =>
                      deleteMutation.mutate({ id: currentProject.id })
                    }
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SkilioPanel>
      )}
    </div>
  );
}
