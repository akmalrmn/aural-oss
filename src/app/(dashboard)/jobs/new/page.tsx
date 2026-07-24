"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ScreeningQuestionEditor,
  type ScreeningQuestionDraft,
} from "@/components/jobs/screening-question-editor";
import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
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

const fieldClass =
  "mt-2 border-[#cfe3c8] bg-white shadow-none focus-visible:ring-[#7bc957]";
const selectTriggerClass =
  "mt-2 border-[#cfe3c8] bg-white shadow-none focus:ring-[#7bc957]";

export default function JobCreationWizardPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { currentProject, isLoading: projectLoading } = useProject();
  const [step, setStep] = useState(0);
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

  async function submit(publish: boolean) {
    if (!currentProject) return;

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
  }

  return (
    <SkilioMotionRoot className="mx-auto max-w-6xl">
      <button
        onClick={() => router.push("/jobs")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#466255] hover:text-[#2f7d4f]"
      >
        <ArrowLeft className="h-4 w-4" />
        Job postings
      </button>

      <div className="mb-6">
        <SkilioHero
          title="Build a job link candidates can trust."
          description="Define the role, weight the right skills, and publish a clean Skilio application page for candidates."
          aside={
            <div className="space-y-3 text-sm text-[var(--skilio-ink-soft)]">
              <div className="font-medium text-[var(--skilio-ink)]">Wizard progress</div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--skilio-control-strong)]">
                <div
                  className="h-full rounded-full bg-[var(--skilio-brand)] transition-all"
                  style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                />
              </div>
              <div>{step + 1} of {steps.length}: {steps[step]}</div>
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <SkilioPanel className="bg-[var(--skilio-panel)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--skilio-brand)]">
            Creation lane
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--skilio-ink)]">Create job</div>
          <div className="mt-5 space-y-3">
            {steps.map((item, index) => (
              <button
                key={item}
                onClick={() => index <= step && setStep(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--skilio-radius-md)] border px-3 py-3 text-left text-sm transition-[background-color,border-color,color] duration-150",
                  index === step
                    ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                    : "border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-ink)]",
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-canvas)] text-xs font-semibold text-[var(--skilio-ink)]">
                  {index < step ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                {item}
              </button>
            ))}
          </div>
        </SkilioPanel>

        <SkilioPanel className="bg-[var(--skilio-panel)] p-5">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-[#14213d]">Role basics</h1>
                <p className="mt-1 text-sm text-[#5f6b7a]">
                  Define the opening candidates will see on the public application page.
                </p>
              </div>
              {!projectLoading && !currentProject && (
                <div className="rounded-lg border border-[#f0d39d] bg-[#fff8e8] p-3 text-sm text-[#7a4d0b]">
                  Create or select a project before publishing a job.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
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
                  <Label>Employment type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger className={selectTriggerClass}>
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
                  <Label>Seniority</Label>
                  <Select value={seniority} onValueChange={setSeniority}>
                    <SelectTrigger className={selectTriggerClass}>
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
                    placeholder="Describe responsibilities, outcomes, and hiring expectations."
                    className={`${fieldClass} min-h-64 resize-y`}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-[#14213d]">Skill requirements</h1>
                <p className="mt-1 text-sm text-[#5f6b7a]">
                  Must-have skills carry more weight in applicant match scoring.
                </p>
              </div>
              <div className="grid gap-3 rounded-2xl border border-[#cfe3c8] bg-white p-4 md:grid-cols-[1fr_140px_140px_auto]">
                <Input
                  value={skillName}
                  onChange={(event) => setSkillName(event.target.value)}
                  placeholder="Add a skill"
                  className="border-[#cfe3c8] bg-white shadow-none focus-visible:ring-[#7bc957]"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <Select value={skillKind} onValueChange={(value) => setSkillKind(value as "HARD" | "SOFT")}>
                  <SelectTrigger className="border-[#cfe3c8] bg-white shadow-none focus:ring-[#7bc957]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HARD">Hard</SelectItem>
                    <SelectItem value="SOFT">Soft</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={skillPriority}
                  onValueChange={(value) => setSkillPriority(value as "MUST" | "NICE")}
                >
                  <SelectTrigger className="border-[#cfe3c8] bg-white shadow-none focus:ring-[#7bc957]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MUST">Must-have</SelectItem>
                    <SelectItem value="NICE">Nice-to-have</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addSkill} className="gap-2 bg-[#2f7d4f] text-white hover:bg-[#256a42]">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              {suggestedSkills.length > 0 && (
                <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4">
                  <div className="text-sm font-semibold text-[var(--skilio-ink)]">
                    Suggested from the job description
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
                        className="gap-2"
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
                </div>
              )}
              <div className="space-y-2">
                {skills.map((skill, index) => (
                  <div
                    key={`${skill.name}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe8db] bg-white p-3"
                  >
                    <div>
                      <div className="font-medium text-[#14213d]">{skill.name}</div>
                      <div className="mt-1 flex gap-2">
                        <Badge variant="secondary" className="rounded-md">
                          {skill.kind === "HARD" ? "Hard skill" : "Soft skill"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md",
                            skill.priority === "MUST"
                              ? "border-[#b6dfaa] text-[#24533b]"
                              : "border-[#d6dde8] text-[#5f6b7a]",
                          )}
                        >
                          {skill.priority === "MUST" ? "Must-have" : "Nice-to-have"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSkills(skills.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-[var(--skilio-ink)]">
                  Pre-screening questions
                </h1>
                <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
                  Ask job-specific questions candidates must answer with their
                  application.
                </p>
              </div>
              <ScreeningQuestionEditor
                questions={screeningQuestions}
                onChange={setScreeningQuestions}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-[#14213d]">Preview and publish</h1>
                <p className="mt-1 text-sm text-[#5f6b7a]">
                  Save as a draft for internal review or publish immediately.
                </p>
              </div>
              <div className="rounded-2xl border border-[#dfe8db] bg-[#fbfdf9] p-5">
                <div className="text-sm font-medium text-[#2f7d4f]">{department || "Department"}</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#14213d]">
                  {title || "Untitled role"}
                </h2>
                <div className="mt-2 text-sm text-[#5f6b7a]">
                  {[location, employmentType, seniority].filter(Boolean).join(" / ")}
                </div>
                <p className="mt-5 whitespace-pre-line text-sm leading-6 text-[#364255]">
                  {description || "Add a description so candidates know what success looks like."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill.name} className="rounded-md bg-[#e6f6df] text-[#24533b]">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
                {screeningQuestions.length > 0 && (
                  <div className="mt-5 border-t border-[var(--skilio-border)] pt-4 text-sm text-[var(--skilio-ink-soft)]">
                    {screeningQuestions.length} pre-screening{" "}
                    {screeningQuestions.length === 1 ? "question" : "questions"} included
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-[#edf2ea] pt-5">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canContinue}
                className="bg-[#2f7d4f] text-white hover:bg-[#256a42]"
              >
                Continue
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={createJob.isLoading || transition.isLoading || projectLoading || !currentProject}
                  onClick={() => submit(false)}
                >
                  Save draft
                </Button>
                <Button
                  disabled={createJob.isLoading || transition.isLoading || projectLoading || !currentProject}
                  onClick={() => submit(true)}
                  className="bg-[#2f7d4f] text-white hover:bg-[#256a42]"
                >
                  Publish
                </Button>
              </div>
            )}
          </div>
        </SkilioPanel>
      </div>
    </SkilioMotionRoot>
  );
}
