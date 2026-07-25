"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  ScreeningQuestionEditor,
  type ScreeningQuestionDraft,
} from "@/components/jobs/screening-question-editor";
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
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const steps = ["Role", "Skills", "Pre-screening", "Preview"] as const;

type SkillDraft = {
  name: string;
  kind: "HARD" | "SOFT";
  priority: "MUST" | "NICE";
};

const starterSkills: SkillDraft[] = [
  { name: "Communication", kind: "SOFT", priority: "MUST" },
  { name: "Problem solving", kind: "SOFT", priority: "MUST" },
];

const skillSignals = [
  { name: "Data analysis", terms: ["data", "analytics", "metrics", "insight"] },
  { name: "Project management", terms: ["project", "roadmap", "delivery", "stakeholder"] },
  { name: "Product strategy", terms: ["product", "strategy", "market", "roadmap"] },
  { name: "User research", terms: ["research", "interview", "customer", "user"] },
  { name: "UX design", terms: ["ux", "experience design", "wireframe", "prototype"] },
  { name: "Figma", terms: ["figma", "prototype", "design system"] },
  { name: "React", terms: ["react", "frontend", "typescript", "javascript"] },
  { name: "SQL", terms: ["sql", "database", "query", "warehouse"] },
  { name: "Python", terms: ["python", "machine learning", "automation"] },
  { name: "Leadership", terms: ["lead", "mentor", "manager", "leadership"] },
];

const fieldClass = "mt-2 shadow-none";
const selectTriggerClass = "mt-2 shadow-none";

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
  const { toast } = useToast();
  const { currentProject, isLoading: projectLoading } = useProject();
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("Remote");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [seniority, setSeniority] = useState("Mid-level");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<SkillDraft[]>(starterSkills);
  const [screeningQuestions, setScreeningQuestions] = useState<
    ScreeningQuestionDraft[]
  >([]);
  const [skillName, setSkillName] = useState("");
  const [skillKind, setSkillKind] = useState<"HARD" | "SOFT">("HARD");
  const [skillPriority, setSkillPriority] = useState<"MUST" | "NICE">("MUST");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createJob = trpc.job.create.useMutation();
  const transition = trpc.job.transition.useMutation();

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

  const suggestedSkills = useMemo(() => {
    const source = `${title} ${department} ${description}`.toLowerCase();
    return skillSignals
      .filter(({ name, terms }) =>
        terms.some((term) => source.includes(term)) &&
        !skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase()),
      )
      .map(({ name }) => name)
      .slice(0, 6);
  }, [department, description, skills, title]);

  function addSkill() {
    const normalized = skillName.trim();
    if (!normalized) return;
    if (skills.some((skill) => skill.name.toLowerCase() === normalized.toLowerCase())) {
      toast({ title: "Skill already added" });
      return;
    }
    setSkills([...skills, { name: normalized, kind: skillKind, priority: skillPriority }]);
    setSkillName("");
  }

  function advance() {
    const nextStep = Math.min(steps.length - 1, step + 1);
    setStep(nextStep);
    setFurthestStep((current) => Math.max(current, nextStep));
    setSubmitError(null);
    resetStepScroll();
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
                  <Select value={employmentType} onValueChange={setEmploymentType}>
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
                  <Select value={seniority} onValueChange={setSeniority}>
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
              <div className="grid gap-4 border-b border-[var(--skilio-border)] pb-6 md:grid-cols-[minmax(0,1fr)_148px_160px_auto] md:items-end">
                <div>
                  <Label htmlFor="skill-name">Skill</Label>
                  <Input
                    id="skill-name"
                    value={skillName}
                    onChange={(event) => setSkillName(event.target.value)}
                    placeholder="For example, Figma"
                    className="mt-2 shadow-none"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addSkill();
                      }
                    }}
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
                <Button
                  type="button"
                  onClick={addSkill}
                  className="w-full gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)] md:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Add skill
                </Button>
              </div>

              {suggestedSkills.length > 0 && (
                <section aria-labelledby="suggested-skills-title">
                  <div className="text-sm font-semibold text-[var(--skilio-ink)]">
                    <span id="suggested-skills-title">
                      Suggested from the role description
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--skilio-ink-soft)]">
                    Review each suggestion before adding it to the role.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedSkills.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-[var(--skilio-radius-sm)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                        onClick={() =>
                          setSkills([
                            ...skills,
                            {
                              name: suggestion,
                              kind: "HARD",
                              priority: "MUST",
                            },
                          ])
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
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
    </SkilioMotionRoot>
  );
}
