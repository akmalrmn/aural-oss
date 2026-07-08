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
import { Loader2 } from "lucide-react";
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
      <SkilioPanel className="p-10 text-center text-[#5e6b7a]">
        No workspace selected
      </SkilioPanel>
    );
  }

  const isAdmin = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <SkilioPanel className="p-6">
        <div className="border-l-2 border-[#7bc957] pl-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f7d4f]">
            General
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-[#10233f]">
            Workspace identity
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5e6b7a]">
            This hiring workspace is currently named &quot;{currentProject.name}&quot;.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Workspace name</Label>
            <Input
              id="projectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className="border-[#dfe8db] bg-[#fbfdf8]"
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
              className="min-h-32 border-[#dfe8db] bg-[#fbfdf8]"
            />
          </div>
          {isAdmin && (
            <Button
              className="rounded-xl bg-[#2f7d4f] text-white hover:bg-[#256a42]"
              onClick={() =>
                updateMutation.mutate({
                  id: currentProject.id,
                  name,
                  description: description || undefined,
                })
              }
              disabled={
                updateMutation.isPending ||
                !name.trim() ||
                (name === currentProject.name &&
                  description === (currentProject.description ?? ""))
              }
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          )}
        </div>
      </SkilioPanel>

      {isAdmin && (
        <SkilioPanel className="border-[#f2c7c7] bg-[#fffafa] p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b42318]">
            Restricted action
          </div>
          <h2 className="mt-2 text-xl font-semibold text-[#10233f]">
            Delete workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6f4b4b]">
            Permanently delete this workspace. Existing job openings and applications will lose this workspace assignment.
          </p>
          <div className="mt-5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="rounded-xl">
                  Delete workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &quot;{currentProject.name}&quot;?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible. Job openings and applications in this workspace will lose their workspace assignment.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() =>
                      deleteMutation.mutate({ id: currentProject.id })
                    }
                  >
                    {deleteMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete permanently
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
