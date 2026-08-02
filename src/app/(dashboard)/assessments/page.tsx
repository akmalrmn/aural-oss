"use client";

import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Link2,
  Lock,
  MessageSquare,
  Plus,
  Timer,
  Users,
} from "lucide-react";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { InterviewWorkspaceHeader } from "@/components/interview/interview-workspace";
import { useProject } from "@/components/project-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function StatCard({
  icon: Icon,
  label,
  loading,
  value,
}: {
  icon: React.ElementType;
  label: string;
  loading: boolean;
  value?: string | number;
}) {
  return (
    <SkilioPanel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">
            {label}
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <div className="mt-2 font-heading text-3xl font-semibold tabular-nums text-[var(--skilio-ink)]">
              {value ?? 0}
            </div>
          )}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </SkilioPanel>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge className="rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">
      {score}%
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="rounded-[var(--skilio-radius-sm)] capitalize">
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}

export default function AssessmentsPage() {
  const { currentProject, isLoading: projectLoading } = useProject();
  const projectId = currentProject?.id;
  const stats = trpc.interview.dashboardStats.useQuery(
    { projectId: projectId ?? undefined },
    { enabled: !projectLoading },
  );
  const interviews = trpc.interview.list.useQuery(
    { limit: 5, projectId: projectId ?? undefined },
    { enabled: !projectLoading },
  );

  const loading = projectLoading || stats.isLoading;
  const recentSessions = stats.data?.recentSessions ?? [];
  const recentInterviews = interviews.data?.interviews ?? [];

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <InterviewWorkspaceHeader
        title="Interview assessment workspace"
        description="Create structured interviews, manage questions, and review candidate sessions without adding an interview to every job application."
        actions={
          <Button asChild className="h-10 gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
            <Link href="/interviews/new">
              <Plus className="h-4 w-4" />
              Create interview
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MessageSquare}
          label="Total interviews"
          loading={loading}
          value={stats.data?.totalInterviews}
        />
        <StatCard
          icon={Users}
          label="Total sessions"
          loading={loading}
          value={stats.data?.totalSessions}
        />
        <StatCard
          icon={Timer}
          label="Total duration"
          loading={loading}
          value={stats.data ? formatDuration(stats.data.totalDuration) : undefined}
        />
        <StatCard
          icon={ClipboardList}
          label="Total questions"
          loading={loading}
          value={stats.data?.totalQuestions}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SkilioPanel>
          <div className="flex items-center justify-between border-b border-[var(--skilio-border)] p-5">
            <h2 className="text-xl font-semibold text-[var(--skilio-ink)]">
              Recent interviews
            </h2>
            <Button asChild variant="outline" className="rounded-[var(--skilio-radius-md)]">
              <Link href="/interviews">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {interviews.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : recentInterviews.length === 0 ? (
            <div className="p-10 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-[var(--skilio-ink-muted)]" />
              <h3 className="mt-4 text-lg font-semibold text-[var(--skilio-ink)]">
                No interviews yet
              </h3>
              <p className="mt-2 text-sm text-[var(--skilio-ink-muted)]">
                Create an interview template when a role needs an assessment step.
              </p>
              <Button asChild className="mt-5 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
                <Link href="/interviews/new">Create interview</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--skilio-border)]">
              {recentInterviews.map((interview) => (
                <Link
                  key={interview.id}
                  href={`/interviews/${interview.id}/edit`}
                  className="flex flex-col gap-3 p-5 transition-colors hover:bg-[var(--skilio-panel)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-[var(--skilio-ink)]">{interview.title}</div>
                    <div className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                      {interview._count.questions} questions / {interview._count.sessions} sessions
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {interview.publicSlug && interview.isActive && !interview.requireInvite ? (
                      <Badge variant="outline" className="max-w-[220px] gap-1 rounded-[var(--skilio-radius-sm)]">
                        <Link2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">/i/{interview.publicSlug}</span>
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 rounded-[var(--skilio-radius-sm)]">
                        <Lock className="h-3 w-3" />
                        Invite only
                      </Badge>
                    )}
                    {interview.chatEnabled && <Badge variant="outline">Chat</Badge>}
                    {interview.voiceEnabled && <Badge variant="outline">Voice</Badge>}
                    {interview.videoEnabled && <Badge variant="outline">Video</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SkilioPanel>

        <SkilioPanel>
          <div className="flex items-center justify-between border-b border-[var(--skilio-border)] p-5">
            <h2 className="text-xl font-semibold text-[var(--skilio-ink)]">
              Recent sessions
            </h2>
            <Button asChild variant="outline" className="rounded-[var(--skilio-radius-md)]">
              <Link href="/candidates">
                Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--skilio-ink-muted)]">
              Interview sessions will appear here after candidates start an assessment.
            </div>
          ) : (
            <div className="divide-y divide-[var(--skilio-border)]">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/interviews/${session.interviewId}/results?session=${session.id}`}
                  className="flex items-center justify-between gap-3 p-5 transition-colors hover:bg-[var(--skilio-panel)]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--skilio-ink)]">
                      {session.name}
                    </div>
                    <div className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                      {new Date(session.date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      / {formatDuration(session.duration)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {session.score !== null && <ScoreBadge score={session.score} />}
                    <StatusBadge status={session.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SkilioPanel>
      </div>
    </SkilioMotionRoot>
  );
}
