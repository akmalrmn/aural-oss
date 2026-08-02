"use client";

import { useParams, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { InterviewResults } from "@/components/interview/interview-results";
import {
  InterviewWorkspace,
  InterviewWorkspaceHeader,
} from "@/components/interview/interview-workspace";

export default function ResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const sessionId = searchParams.get("session") ?? undefined;

  const interview = trpc.interview.getById.useQuery({ id });

  if (interview.isLoading) {
    return <Skeleton className="h-[600px]" />;
  }

  return (
    <InterviewWorkspace>
      <InterviewWorkspaceHeader
        title={`${interview.data?.title ?? "Interview"} — Results`}
        description="Review candidate performance and compare completed interview sessions."
      />

      <InterviewResults interviewId={id} initialSessionId={sessionId} />
    </InterviewWorkspace>
  );
}
