"use client";

import { useAuth } from "@/components/auth-provider";
import { useOrg } from "@/components/org-provider";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";
import {
  Building2,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

type TeamRole = "ADMIN" | "MEMBER" | "VIEWER";

const roleDetails: Record<
  "OWNER" | TeamRole,
  { label: string; description: string }
> = {
  OWNER: {
    label: "Owner",
    description: "Full company and billing control",
  },
  ADMIN: {
    label: "Admin",
    description: "Manages workspaces and teammates",
  },
  MEMBER: {
    label: "Member",
    description: "Creates jobs and reviews applicants",
  },
  VIEWER: {
    label: "Viewer",
    description: "Views hiring activity only",
  },
};

function getInitials(name: string | null | undefined, email: string | undefined) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function RoleBadge({ role }: { role: string }) {
  const details =
    roleDetails[role as keyof typeof roleDetails] ?? roleDetails.MEMBER;
  const emphasized = role === "OWNER" || role === "ADMIN";

  return (
    <span
      className={
        emphasized
          ? "inline-flex min-h-7 items-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] px-2.5 text-xs font-semibold text-[var(--skilio-brand-strong)]"
          : "inline-flex min-h-7 items-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] px-2.5 text-xs font-semibold text-[var(--skilio-ink-soft)]"
      }
    >
      {details.label}
    </span>
  );
}

export function CompanyMembersPanel() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("MEMBER");
  const canSubmitInvite = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    inviteEmail.trim(),
  );

  const membersQuery = trpc.orgMember.list.useQuery(
    { organizationId: currentOrg?.id ?? "" },
    { enabled: Boolean(currentOrg) },
  );

  const inviteMutation = trpc.orgMember.invite.useMutation({
    onSuccess: (result) => {
      toast({
        title: result.invitationSent ? "Invitation sent" : "Teammate added",
        description: result.invitationSent
          ? `${inviteEmail.trim().toLowerCase()} can join from the email invitation.`
          : `${inviteEmail.trim().toLowerCase()} now has access to this company.`,
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("MEMBER");
      void utils.orgMember.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Unable to add teammate",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = trpc.orgMember.updateRole.useMutation({
    onSuccess: () => {
      toast({ title: "Team role updated" });
      void utils.orgMember.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Unable to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMutation = trpc.orgMember.remove.useMutation({
    onSuccess: () => {
      toast({ title: "Teammate removed" });
      void utils.orgMember.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Unable to remove teammate",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const leaveMutation = trpc.orgMember.leave.useMutation({
    onSuccess: () => {
      toast({ title: "You left the company workspace" });
      void utils.organization.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Unable to leave workspace",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!currentOrg) {
    return (
      <section className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-8 text-center">
        <Building2
          className="mx-auto h-6 w-6 text-[var(--skilio-ink-muted)]"
          aria-hidden="true"
        />
        <h2 className="mt-3 text-lg font-semibold text-[var(--skilio-ink)]">
          No company selected
        </h2>
        <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
          Select a company workspace to manage its team.
        </p>
      </section>
    );
  }

  const isOwner = currentOrg.role === "OWNER";
  const canManage = isOwner || currentOrg.role === "ADMIN";
  const members = membersQuery.data ?? [];

  const changeRole = (userId: string, role: TeamRole) => {
    updateRoleMutation.mutate({
      organizationId: currentOrg.id,
      userId,
      role,
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-1)]">
        <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--skilio-ink)]">
                Team access
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
                {currentOrg.name} members share its jobs, applicants, and hiring
                workspaces.
              </p>
            </div>
          </div>

          {canManage && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 shrink-0 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98]">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Invite teammate
                </Button>
              </DialogTrigger>
              <DialogContent className="skilio-interface w-[calc(100%-2rem)] rounded-[var(--skilio-radius-lg)] border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-2)] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">Invite a teammate</DialogTitle>
                  <DialogDescription className="leading-6 text-[var(--skilio-ink-soft)]">
                    Existing accounts are added immediately. New teammates receive
                    an email to create their employer password.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="teamInviteEmail">Work email</Label>
                    <Input
                      id="teamInviteEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      disabled={inviteMutation.isPending}
                      className="h-10 border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] focus-visible:ring-[var(--skilio-brand)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teamInviteRole">Company role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as TeamRole)}
                      disabled={inviteMutation.isPending}
                    >
                      <SelectTrigger id="teamInviteRole">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isOwner && (
                          <SelectItem value="ADMIN">
                            <span className="font-medium">Admin</span>
                          </SelectItem>
                        )}
                        <SelectItem value="MEMBER">
                          <span className="font-medium">Member</span>
                        </SelectItem>
                        <SelectItem value="VIEWER">
                          <span className="font-medium">Viewer</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-[var(--skilio-ink-muted)]">
                      {roleDetails[inviteRole].description}.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                    className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      inviteMutation.mutate({
                        organizationId: currentOrg.id,
                        email: inviteEmail.trim().toLowerCase(),
                        role: inviteRole,
                      })
                    }
                    disabled={
                      inviteMutation.isPending || !canSubmitInvite
                    }
                    className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
                  >
                    {inviteMutation.isPending && (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {inviteMutation.isPending ? "Sending…" : "Send invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--skilio-border)] bg-[var(--skilio-panel)] px-5 py-3 text-xs text-[var(--skilio-ink-muted)] sm:px-6">
          <span className="font-medium tabular-nums text-[var(--skilio-ink-soft)]">
            {members.length} {members.length === 1 ? "teammate" : "teammates"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck
              className="h-3.5 w-3.5 text-[var(--skilio-brand)]"
              aria-hidden="true"
            />
            Access is isolated to {currentOrg.name}
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-1)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(150px,0.45fr)_140px_44px] items-center gap-4 border-b border-[var(--skilio-border)] bg-[var(--skilio-panel)] px-6 py-3 text-xs font-semibold text-[var(--skilio-ink-muted)] md:grid">
          <span>Teammate</span>
          <span>Company role</span>
          <span>Joined</span>
          <span className="sr-only">Actions</span>
        </div>

        {membersQuery.isLoading ? (
          <div className="space-y-px bg-[var(--skilio-border)]" role="status">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="grid min-h-20 animate-pulse grid-cols-[40px_minmax(0,1fr)] gap-3 bg-[var(--skilio-elevated)] px-5 py-4 sm:px-6"
              >
                <div className="h-10 w-10 rounded-full bg-[var(--skilio-control)]" />
                <div className="space-y-2 py-1">
                  <div className="h-3 w-36 rounded bg-[var(--skilio-control)]" />
                  <div className="h-3 w-52 max-w-full rounded bg-[var(--skilio-control)]" />
                </div>
              </div>
            ))}
            <span className="sr-only">Loading teammates</span>
          </div>
        ) : members.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users
              className="mx-auto h-6 w-6 text-[var(--skilio-ink-muted)]"
              aria-hidden="true"
            />
            <h3 className="mt-3 text-base font-semibold text-[var(--skilio-ink)]">
              No teammates yet
            </h3>
            <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
              Invite the first person who will help manage hiring.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--skilio-border)]">
            {members.map((member) => {
              const role = member.role as "OWNER" | TeamRole;
              const name =
                member.profile?.name?.trim() ||
                member.profile?.email?.split("@")[0] ||
                "Unnamed teammate";
              const email = member.profile?.email ?? "";
              const isCurrentUser = member.userId === user?.id;

              return (
                <li
                  key={member.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 px-5 py-4 transition-colors hover:bg-[var(--skilio-panel)] sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.45fr)_140px_44px] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage
                        src={member.profile?.avatar ?? undefined}
                        alt=""
                      />
                      <AvatarFallback className="bg-[var(--skilio-control-strong)] text-xs font-semibold text-[var(--skilio-brand-strong)]">
                        {getInitials(name, email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--skilio-ink)]">
                        {name}
                        {isCurrentUser && (
                          <span className="ml-1.5 font-normal text-[var(--skilio-ink-muted)]">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--skilio-ink-muted)]">
                        {email}
                      </p>
                    </div>
                  </div>

                  <div className="justify-self-end md:justify-self-start">
                    {canManage && role !== "OWNER" && !isCurrentUser ? (
                      <Select
                        value={role}
                        onValueChange={(value) =>
                          changeRole(member.userId, value as TeamRole)
                        }
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger
                          className="h-9 w-[116px] bg-[var(--skilio-control)] sm:w-[132px]"
                          aria-label={`Role for ${name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {isOwner && (
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          )}
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <RoleBadge role={role} />
                    )}
                  </div>

                  <time
                    dateTime={member.joinedAt}
                    className="col-start-1 text-xs tabular-nums text-[var(--skilio-ink-muted)] md:col-auto md:text-sm"
                  >
                    <span className="md:hidden">Joined </span>
                    {new Intl.DateTimeFormat("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(member.joinedAt))}
                  </time>

                  <div className="col-start-2 row-start-2 justify-self-end md:col-auto md:row-auto">
                    {canManage && role !== "OWNER" && !isCurrentUser && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${name}`}
                            title={`Remove ${name}`}
                            className="h-9 w-9 text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-danger-soft)] hover:text-[var(--skilio-danger)]"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="skilio-interface border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
                            <AlertDialogDescription className="text-[var(--skilio-ink-soft)]">
                              They will lose access to all jobs, applicants, and
                              workspaces in {currentOrg.name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                removeMutation.mutate({
                                  organizationId: currentOrg.id,
                                  userId: member.userId,
                                })
                              }
                              className="bg-[var(--skilio-danger)] text-white hover:bg-[var(--skilio-danger)]/90"
                            >
                              Remove teammate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!canManage && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="text-[var(--skilio-danger)] hover:bg-[var(--skilio-danger-soft)] hover:text-[var(--skilio-danger)]"
                disabled={leaveMutation.isPending}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Leave company workspace
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="skilio-interface border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)]">
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {currentOrg.name}?</AlertDialogTitle>
                <AlertDialogDescription className="text-[var(--skilio-ink-soft)]">
                  You will lose access to its jobs, applicants, and hiring
                  workspaces. An admin must invite you again to restore access.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    leaveMutation.mutate({ organizationId: currentOrg.id })
                  }
                  className="bg-[var(--skilio-danger)] text-white hover:bg-[var(--skilio-danger)]/90"
                >
                  Leave workspace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
