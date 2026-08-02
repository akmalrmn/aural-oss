"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  GenerateJobDraftDialog,
  JobDraftReviewDialog,
  type JobAuthoringValues,
  type JobDraftApplyField,
} from "@/components/jobs/job-draft-authoring";
import {
  ScreeningQuestionEditor,
  type ScreeningQuestionDraft,
} from "@/components/jobs/screening-question-editor";
import {
  SkillCataloguePicker,
  type CatalogueSkill,
} from "@/components/jobs/skill-catalogue-picker";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { useProject } from "@/components/project-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { JobDraft } from "@/lib/jobs/job-draft-schema";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const steps = ["Role", "Skills", "Pre-screening", "Preview"] as const;

type SkillDraft = {
  name: string;
  kind: "HARD" | "SOFT";
  priority: "MUST" | "NICE";
  lightcastId?: string | null;
  lightcastType?: string | null;
  lightcastDescription?: string | null;
  lightcastApiVersion?: string | null;
  lightcastCategoryId?: string | null;
  lightcastCategoryName?: string | null;
  lightcastSubcategoryId?: string | null;
  lightcastSubcategoryName?: string | null;
  skillSource: "LIGHTCAST" | "CUSTOM";
};

const starterSkills: SkillDraft[] = [];

const fieldClass = "mt-2 shadow-none";
const selectTriggerClass = "mt-2 shadow-none";
const jobDocumentAccept = ".pdf,.docx,.txt";

const stepCopy = [
  {
    title: "Role details",
    description:
      "Set the information candidates need to understand the opening.",
  },
  {
    title: "Skills and signals",
    description:
      "Choose the capabilities that will shape applicant matching.",
  },
  {
    title: "Pre-screening questions",
    description:
      "Ask only the questions needed before an application reaches review.",
  },
  {
    title: "Review and publish",
    description:
      "Check the public job information, then save or publish the opening.",
  },
] as const;

function resetStepScroll() {
  window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  document.scrollingElement?.scrollTo({
    left: 0,
    top: 0,
    behavior: "auto",
  });
}

export default function JobCreationWizardPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { toast, dismiss } = useToast();
  const { currentProject, isLoading: projectLoading } = useProject();
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("Remote");
  const [employmentType, setEmploymentType] =
    useState<JobAuthoringValues["employmentType"]>("Full-time");
  const [seniority, setSeniority] =
    useState<JobAuthoringValues["seniority"]>("Mid-level");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<SkillDraft[]>(starterSkills);
  const [suggestedSkills, setSuggestedSkills] = useState<CatalogueSkill[]>([]);
  const [lastSuggestedDescription, setLastSuggestedDescription] = useState("");
  const [screeningQuestions, setScreeningQuestions] = useState<
    ScreeningQuestionDraft[]
  >([]);
  const [skillKind, setSkillKind] = useState<"HARD" | "SOFT">("HARD");
  const [skillPriority, setSkillPriority] = useState<"MUST" | "NICE">("MUST");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [draftReview, setDraftReview] = useState<{
    draft: JobDraft;
    sourceLabel: string;
  } | null>(null);
  const [authoringError, setAuthoringError] = useState<string | null>(null);
  const [importingDocument, setImportingDocument] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const createJob = trpc.job.create.useMutation();
  const transition = trpc.job.transition.useMutation();
  const suggestSkills = trpc.job.suggestSkills.useMutation();
  const generateDraft = trpc.job.generateDraft.useMutation();

  const authoringValues = useMemo<JobAuthoringValues>(
    () => ({
      title,
      department,
      location,
      employmentType,
      seniority,
      description,
    }),
    [
      department,
      description,
      employmentType,
      location,
      seniority,
      title,
    ],
  );

  const canContinue = useMemo(() => {
    if (step === 0) return title.trim().length >= 2 && !!currentProject && !projectLoading;
    if (step === 1) return skills.length > 0;
    if (step === 2) {
      return screeningQuestions.every(
        (question) =>
          question.prompt.trim().length >= 3 &&
          (question.type !== "SELECT" || question.options.length >= 2),
      );
    }
    return true;
  }, [currentProject, projectLoading, screeningQuestions, skills.length, step, title]);

  const availableSuggestions = useMemo(
    () =>
      suggestedSkills.filter(
        (suggestion) =>
          !skills.some(
            (skill) =>
              skill.lightcastId === suggestion.id ||
              skill.name.toLowerCase() === suggestion.name.toLowerCase(),
          ),
      ),
    [skills, suggestedSkills],
  );

  function addSkill(skill: SkillDraft) {
    const normalized = skill.name.trim();
    if (!normalized) return;
    if (skills.some((skill) => skill.name.toLowerCase() === normalized.toLowerCase())) {
      toast({ title: "Skill already added" });
      return;
    }
    setSkills([...skills, { ...skill, name: normalized }]);
  }

  function addCatalogueSkill(skill: CatalogueSkill) {
    addSkill({
      name: skill.name,
      kind: skill.type === "Common Skill" ? "SOFT" : skillKind,
      priority: skillPriority,
      lightcastId: skill.id,
      lightcastType: skill.type,
      lightcastDescription: skill.description,
      lightcastApiVersion: skill.apiVersion,
      lightcastCategoryId: skill.categoryId,
      lightcastCategoryName: skill.categoryName,
      lightcastSubcategoryId: skill.subcategoryId,
      lightcastSubcategoryName: skill.subcategoryName,
      skillSource: "LIGHTCAST",
    });
  }

  function addCustomSkill(name: string) {
    addSkill({
      name,
      kind: skillKind,
      priority: skillPriority,
      skillSource: "CUSTOM",
    });
  }

  function presentDraft(draft: JobDraft, sourceLabel: string) {
    dismiss();
    setDraftReview({ draft, sourceLabel });
    setReviewDialogOpen(true);
    setGenerateDialogOpen(false);
    setAuthoringError(null);
  }

  async function generateFromBrief(
    input: Omit<JobAuthoringValues, "description"> & { notes: string },
  ) {
    if (!currentProject) return;
    setAuthoringError(null);
    try {
      const draft = await generateDraft.mutateAsync({
        projectId: currentProject.id,
        ...input,
      });
      presentDraft(draft, "AI-generated role draft");
    } catch (error) {
      setAuthoringError(
        error instanceof Error
          ? error.message
          : "The role draft could not be generated. Retry with more context.",
      );
    }
  }

  async function importJobDocument(file: File) {
    if (!currentProject) return;
    setImportingDocument(true);
    setAuthoringError(null);
    try {
      const formData = new FormData();
      formData.append("projectId", currentProject.id);
      formData.append("file", file);
      const response = await fetch("/api/jobs/draft/import", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        draft?: JobDraft;
        fileName?: string;
        error?: string;
      };
      if (!response.ok || !result.draft) {
        throw new Error(
          result.error ||
            "The job description could not be imported. Check the file and retry.",
        );
      }
      presentDraft(
        result.draft,
        `Imported from ${result.fileName || file.name}`,
      );
    } catch (error) {
      setAuthoringError(
        error instanceof Error
          ? error.message
          : "The job description could not be imported.",
      );
    } finally {
      setImportingDocument(false);
    }
  }

  async function applyDraft(fields: Set<JobDraftApplyField>) {
    if (!draftReview) return;
    const draft = draftReview.draft;

    if (fields.has("title")) setTitle(draft.title);
    if (fields.has("department")) setDepartment(draft.department);
    if (fields.has("location")) setLocation(draft.location);
    if (fields.has("employmentType")) {
      setEmploymentType(draft.employmentType);
    }
    if (fields.has("seniority")) setSeniority(draft.seniority);
    if (fields.has("description")) setDescription(draft.description);
    if (fields.has("screeningQuestions")) {
      setScreeningQuestions(
        draft.screeningQuestions.map((question, index) => ({
          ...question,
          id: `generated-${Date.now()}-${index}`,
        })),
      );
    }

    setReviewDialogOpen(false);
    toast({
      title: "Draft applied",
      description:
        fields.has("description") && draft.skillQueries.length
          ? "Role details were updated. Matching the skills with Lightcast now."
          : "The selected role details were added to this job.",
    });

    if (fields.has("description")) {
      setLastSuggestedDescription(draft.description);
      try {
        setSuggestedSkills(
          await suggestSkills.mutateAsync({
            description: draft.description,
            limit: 12,
          }),
        );
      } catch {
        setSuggestedSkills([]);
      }
    }
  }

  async function advance() {
    const nextStep = Math.min(steps.length - 1, step + 1);
    setStep(nextStep);
    setFurthestStep((current) => Math.max(current, nextStep));
    setSubmitError(null);
    resetStepScroll();

    const normalizedDescription = description.trim();
    if (
      step === 0 &&
      normalizedDescription.length >= 80 &&
      normalizedDescription !== lastSuggestedDescription
    ) {
      setLastSuggestedDescription(normalizedDescription);
      try {
        const suggestions = await suggestSkills.mutateAsync({
          description: normalizedDescription,
          limit: 12,
        });
        setSuggestedSkills(suggestions);
      } catch {
        setSuggestedSkills([]);
      }
    }
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
    setSubmitError(null);
    resetStepScroll();
  }

  async function submit(publish: boolean) {
    if (!currentProject) return;

    setSubmitError(null);
    try {
      const job = await createJob.mutateAsync({
        projectId: currentProject.id,
        title: title.trim(),
        department: department.trim() || undefined,
        location: location.trim() || undefined,
        employmentType,
        seniority,
        description: description.trim() || undefined,
        skills,
        screeningQuestions: screeningQuestions
          .filter((question) => question.prompt.trim().length >= 3)
          .map((question) => ({
            ...question,
            prompt: question.prompt.trim(),
            options:
              question.type === "SELECT"
                ? question.options.map((option) => option.trim()).filter(Boolean)
                : [],
          })),
      });

      if (publish) {
        await transition.mutateAsync({ id: job.id, action: "publish" });
      }

      await utils.job.list.invalidate();
      toast({ title: publish ? "Job published" : "Draft saved" });
      router.push(`/jobs/${job.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The job could not be saved. Check your connection and try again.",
      );
    }
  }

  return (
    <SkilioMotionRoot className="mx-auto max-w-5xl pb-10">
      <button
        onClick={() => router.push("/jobs")}
        className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--skilio-radius-sm)] px-1 text-sm font-medium text-[var(--skilio-ink-soft)] transition-colors hover:text-[var(--skilio-brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Job postings
      </button>

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium text-[var(--skilio-brand-strong)]">
            New opening
          </div>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-[var(--skilio-ink)] sm:text-4xl">
            Create a job
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)] sm:text-[15px]">
            Define the role, set the evidence that matters, and prepare the
            public application page.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--skilio-ink-muted)]">
          <span className="h-2 w-2 rounded-full bg-[var(--skilio-ink-muted)]" />
          Draft not saved
        </div>
      </header>

      <nav
        aria-label="Job creation progress"
        className="mb-6 border-y border-[var(--skilio-border)] py-4"
      >
        <div className="mb-3 flex items-center justify-between sm:hidden">
          <div>
            <div className="text-xs font-medium tabular-nums text-[var(--skilio-ink-muted)]">
              Step {step + 1} of {steps.length}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--skilio-ink)]">
              {steps[step]}
            </div>
          </div>
          {step < steps.length - 1 && (
            <div className="text-right text-xs text-[var(--skilio-ink-muted)]">
              Next
              <div className="mt-0.5 text-sm font-medium text-[var(--skilio-ink-soft)]">
                {steps[step + 1]}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {steps.map((item, index) => {
            const accessible = index <= furthestStep;
            const complete = index < step;
            const active = index === step;
            return (
              <button
                key={item}
                type="button"
                disabled={!accessible}
                aria-label={item}
                aria-current={active ? "step" : undefined}
                onClick={() => {
                  if (!accessible) return;
                  setStep(index);
                  setSubmitError(null);
                  resetStepScroll();
                }}
                className="group min-w-0 text-left focus-visible:outline-none disabled:cursor-default"
              >
                <span
                  className={cn(
                    "block h-1 rounded-full transition-colors",
                    active || complete
                      ? "bg-[var(--skilio-brand)]"
                      : "bg-[var(--skilio-control-strong)]",
                    accessible &&
                      !active &&
                      "group-hover:bg-[var(--skilio-border-strong)]",
                  )}
                />
                <span className="mt-3 hidden items-center gap-2 sm:flex">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] text-xs font-semibold tabular-nums",
                      active
                        ? "bg-[var(--skilio-brand)] text-white"
                        : complete
                          ? "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                          : "bg-[var(--skilio-control)] text-[var(--skilio-ink-muted)]",
                    )}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      active
                        ? "text-[var(--skilio-ink)]"
                        : "text-[var(--skilio-ink-muted)]",
                    )}
                  >
                    {item}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <SkilioPanel className="bg-[var(--skilio-elevated)]">
        <div className="border-b border-[var(--skilio-border)] px-5 py-5 sm:px-7 sm:py-6">
          <div className="text-xs font-medium tabular-nums text-[var(--skilio-ink-muted)]">
            Step {step + 1} of {steps.length}
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--skilio-ink)]">
            {stepCopy[step].title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
            {stepCopy[step].description}
          </p>
        </div>

        <div className="px-5 py-6 sm:px-7 sm:py-7">
          {step === 0 && (
            <div className="space-y-6">
              {!projectLoading && !currentProject && (
                <div
                  role="alert"
                  className="flex gap-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] p-4 text-sm text-[var(--skilio-ink-soft)]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--skilio-brand-strong)]" />
                  <div>
                    <div className="font-semibold text-[var(--skilio-ink)]">
                      Select a workspace first
                    </div>
                    <p className="mt-1">
                      Choose or create a workspace before continuing with this
                      job.
                    </p>
                  </div>
                </div>
              )}
              <section
                aria-labelledby="authoring-tools-title"
                className="flex flex-col gap-4 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="max-w-xl">
                  <h3
                    id="authoring-tools-title"
                    className="text-sm font-semibold text-[var(--skilio-ink)]"
                  >
                    Start from a brief or an existing JD
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                    Build a reviewed draft with AI, or import a PDF, DOCX, or TXT
                    file. Your current fields stay unchanged until you approve
                    them.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--skilio-ink-muted)]">
                    Only upload hiring content you are permitted to share. Files
                    are processed by Skilio&apos;s configured AI providers and
                    are not attached to the job.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!currentProject || projectLoading}
                    onClick={() => {
                      setAuthoringError(null);
                      setGenerateDialogOpen(true);
                    }}
                    className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-panel)]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Draft with AI
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      importingDocument || !currentProject || projectLoading
                    }
                    onClick={() => documentInputRef.current?.click()}
                    className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-panel)]"
                  >
                    {importingDocument ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    {importingDocument ? "Importing..." : "Upload JD"}
                  </Button>
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept={jobDocumentAccept}
                    className="sr-only"
                    data-testid="job-document-input"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void importJobDocument(file);
                    }}
                  />
                </div>
              </section>
              {authoringError && !generateDialogOpen && (
                <div
                  role="alert"
                  className="flex gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-danger-soft)] p-4 text-sm text-[var(--skilio-danger)]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Authoring tool unavailable</div>
                    <p className="mt-1 leading-5">{authoringError}</p>
                  </div>
                </div>
              )}
              <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="title">Job title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Senior Product Designer"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder="Design"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label htmlFor="employment-type">Employment type</Label>
                  <Select
                    value={employmentType}
                    onValueChange={(value) =>
                      setEmploymentType(
                        value as JobAuthoringValues["employmentType"],
                      )
                    }
                  >
                    <SelectTrigger
                      id="employment-type"
                      className={selectTriggerClass}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="seniority">Seniority</Label>
                  <Select
                    value={seniority}
                    onValueChange={(value) =>
                      setSeniority(value as JobAuthoringValues["seniority"])
                    }
                  >
                    <SelectTrigger id="seniority" className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entry-level">Entry-level</SelectItem>
                      <SelectItem value="Mid-level">Mid-level</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">Job description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the role, responsibilities, outcomes, and what success looks like."
                    className={`${fieldClass} min-h-56 resize-y leading-6`}
                  />
                  <p className="mt-2 text-xs leading-5 text-[var(--skilio-ink-muted)]">
                    This appears on the public application page. Keep it
                    specific and easy to scan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="grid gap-4 border-b border-[var(--skilio-border)] pb-6 md:grid-cols-[minmax(0,1fr)_148px_160px] md:items-end">
                <div>
                  <Label>Skill</Label>
                  <SkillCataloguePicker
                    excludedNames={skills.map((skill) => skill.name)}
                    onSelect={addCatalogueSkill}
                    onAddCustom={addCustomSkill}
                  />
                </div>
                <div>
                  <Label htmlFor="skill-type">Type</Label>
                  <Select
                    value={skillKind}
                    onValueChange={(value) =>
                      setSkillKind(value as "HARD" | "SOFT")
                    }
                  >
                    <SelectTrigger id="skill-type" className="mt-2 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HARD">Hard skill</SelectItem>
                      <SelectItem value="SOFT">Soft skill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="skill-priority">Priority</Label>
                  <Select
                    value={skillPriority}
                    onValueChange={(value) =>
                      setSkillPriority(value as "MUST" | "NICE")
                    }
                  >
                    <SelectTrigger id="skill-priority" className="mt-2 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MUST">Must-have</SelectItem>
                      <SelectItem value="NICE">Nice-to-have</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(description.trim().length >= 80 || suggestSkills.isLoading) && (
                <section aria-labelledby="suggested-skills-title">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--skilio-ink)]">
                      <span id="suggested-skills-title">
                        Suggested from the job description
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={
                        suggestSkills.isLoading || description.trim().length < 80
                      }
                      onClick={async () => {
                        const normalizedDescription = description.trim();
                        setLastSuggestedDescription(normalizedDescription);
                        try {
                          setSuggestedSkills(
                            await suggestSkills.mutateAsync({
                              description: normalizedDescription,
                              limit: 12,
                            }),
                          );
                        } catch {
                          setSuggestedSkills([]);
                        }
                      }}
                      className="text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control)]"
                    >
                      {suggestSkills.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Refresh suggestions
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-[var(--skilio-ink-soft)]">
                    Lightcast identified these capabilities. Add only the ones
                    the role genuinely requires.
                  </p>
                  {suggestSkills.isLoading ? (
                    <div className="mt-3 flex min-h-16 items-center gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-4 text-sm text-[var(--skilio-ink-soft)]">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--skilio-brand)]" />
                      Reading the job description
                    </div>
                  ) : suggestSkills.isError ? (
                    <div className="mt-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] px-4 py-3 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                      Suggestions are unavailable right now. Search the catalogue
                      or add a custom skill above.
                    </div>
                  ) : availableSuggestions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableSuggestions.map((suggestion) => (
                        <Button
                          key={suggestion.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-[var(--skilio-radius-sm)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                          onClick={() => addCatalogueSkill(suggestion)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {suggestion.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--skilio-ink-muted)]">
                      No additional catalogue suggestions.
                    </p>
                  )}
                </section>
              )}

              <section aria-labelledby="selected-skills-title">
                <div className="flex items-baseline justify-between gap-4 border-b border-[var(--skilio-border)] pb-3">
                  <h3
                    id="selected-skills-title"
                    className="text-base font-semibold text-[var(--skilio-ink)]"
                  >
                    Selected skills
                  </h3>
                  <span className="text-xs tabular-nums text-[var(--skilio-ink-muted)]">
                    {skills.length} {skills.length === 1 ? "skill" : "skills"}
                  </span>
                </div>
                {skills.map((skill, index) => (
                  <div
                    key={`${skill.name}-${index}`}
                    className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[var(--skilio-border)] py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--skilio-ink)]">
                        {skill.name}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <Badge
                          variant="secondary"
                          className="rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)]"
                        >
                          {skill.kind === "HARD" ? "Hard skill" : "Soft skill"}
                        </Badge>
                        {skill.skillSource === "LIGHTCAST" && (
                          <Badge
                            variant="outline"
                            className="rounded-[var(--skilio-radius-sm)] border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-muted)]"
                          >
                            Lightcast
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-[var(--skilio-radius-sm)]",
                            skill.priority === "MUST"
                              ? "border-[var(--skilio-border-strong)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                              : "border-[var(--skilio-border)] text-[var(--skilio-ink-muted)]",
                          )}
                        >
                          {skill.priority === "MUST" ? "Must-have" : "Nice-to-have"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${skill.name}`}
                      className="text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-danger-soft)] hover:text-[var(--skilio-danger)]"
                      onClick={() => setSkills(skills.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </section>
            </div>
          )}

          {step === 2 && (
            <div>
              <ScreeningQuestionEditor
                questions={screeningQuestions}
                onChange={setScreeningQuestions}
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
              <article aria-label="Public job preview" className="min-w-0">
                <div className="text-sm font-medium text-[var(--skilio-brand-strong)]">
                  {department || "Department"}
                </div>
                <h3 className="mt-2 break-words text-3xl font-semibold leading-tight text-[var(--skilio-ink)]">
                  {title || "Untitled role"}
                </h3>
                <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-[var(--skilio-ink-muted)]">
                  {[location, employmentType, seniority]
                    .filter(Boolean)
                    .map((item, index) => (
                      <span key={item} className="inline-flex items-center gap-2">
                        {index > 0 && (
                          <span aria-hidden="true" className="text-[var(--skilio-border-strong)]">
                            /
                          </span>
                        )}
                        {item}
                      </span>
                    ))}
                </div>
                <div className="mt-7 border-t border-[var(--skilio-border)] pt-6">
                  <p className="max-w-[72ch] whitespace-pre-line text-sm leading-7 text-[var(--skilio-ink-soft)]">
                    {description ||
                      "Add a description so candidates know what success looks like."}
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge
                      key={skill.name}
                      className="rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]"
                    >
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </article>

              <aside className="border-t border-[var(--skilio-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h3 className="text-sm font-semibold text-[var(--skilio-ink)]">
                  Ready to publish
                </h3>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-xs text-[var(--skilio-ink-muted)]">
                      Skills
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums text-[var(--skilio-ink)]">
                      {skills.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--skilio-ink-muted)]">
                      Pre-screening
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums text-[var(--skilio-ink)]">
                      {screeningQuestions.length}{" "}
                      {screeningQuestions.length === 1 ? "question" : "questions"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--skilio-ink-muted)]">
                      Application link
                    </dt>
                    <dd className="mt-1 text-sm leading-5 text-[var(--skilio-ink-soft)]">
                      Created when this job is published
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="mt-6 flex gap-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-danger)] bg-[var(--skilio-danger-soft)] p-4 text-sm text-[var(--skilio-danger)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">The job could not be saved</div>
                <p className="mt-1">{submitError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--skilio-border)] bg-[var(--skilio-panel)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={step === 0}
            className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={advance}
              disabled={!canContinue}
              className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                disabled={
                  createJob.isLoading ||
                  transition.isLoading ||
                  projectLoading ||
                  !currentProject
                }
                onClick={() => submit(false)}
                className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
              >
                Save draft
              </Button>
              <Button
                disabled={
                  createJob.isLoading ||
                  transition.isLoading ||
                  projectLoading ||
                  !currentProject
                }
                onClick={() => submit(true)}
                className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
              >
                {(createJob.isLoading || transition.isLoading) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {createJob.isLoading || transition.isLoading
                  ? "Publishing..."
                  : "Publish job"}
              </Button>
            </div>
          )}
        </div>
      </SkilioPanel>

      <GenerateJobDraftDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        current={authoringValues}
        loading={generateDraft.isLoading}
        error={authoringError}
        onGenerate={(input) => void generateFromBrief(input)}
      />
      <JobDraftReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        draft={draftReview?.draft ?? null}
        sourceLabel={draftReview?.sourceLabel ?? "Proposed job draft"}
        current={authoringValues}
        onApply={(fields) => void applyDraft(fields)}
      />
    </SkilioMotionRoot>
  );
}
