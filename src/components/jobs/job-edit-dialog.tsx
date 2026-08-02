"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ScreeningQuestionEditor,
  type ScreeningQuestionDraft,
} from "@/components/jobs/screening-question-editor";
import {
  SkillCataloguePicker,
  type CatalogueSkill,
} from "@/components/jobs/skill-catalogue-picker";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";

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

type EditableJob = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  description?: string | null;
  screeningQuestions?: ScreeningQuestionDraft[] | null;
  job_skills: {
    name: string;
    kind: string;
    priority: string;
    lightcastId?: string | null;
    lightcastType?: string | null;
    lightcastDescription?: string | null;
    lightcastApiVersion?: string | null;
    lightcastCategoryId?: string | null;
    lightcastCategoryName?: string | null;
    lightcastSubcategoryId?: string | null;
    lightcastSubcategoryName?: string | null;
    skillSource?: string | null;
  }[];
};

export function JobEditDialog({ job }: { job: EditableJob }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(job.title);
  const [department, setDepartment] = useState(job.department ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [employmentType, setEmploymentType] = useState(
    job.employmentType ?? "Full-time",
  );
  const [seniority, setSeniority] = useState(job.seniority ?? "Mid-level");
  const [description, setDescription] = useState(job.description ?? "");
  const [skills, setSkills] = useState<SkillDraft[]>([]);
  const [screeningQuestions, setScreeningQuestions] = useState<
    ScreeningQuestionDraft[]
  >([]);
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const updateJob = trpc.job.update.useMutation({
    onSuccess: async () => {
      await utils.job.getById.invalidate({ id: job.id });
      await utils.job.list.invalidate();
      toast({ title: "Job post updated" });
      setOpen(false);
    },
  });

  useEffect(() => {
    if (!open) return;
    setTitle(job.title);
    setDepartment(job.department ?? "");
    setLocation(job.location ?? "");
    setEmploymentType(job.employmentType ?? "Full-time");
    setSeniority(job.seniority ?? "Mid-level");
    setDescription(job.description ?? "");
    setSkills(
      job.job_skills.map((skill) => ({
        name: skill.name,
        kind: skill.kind === "SOFT" ? "SOFT" : "HARD",
        priority: skill.priority === "NICE" ? "NICE" : "MUST",
        lightcastId: skill.lightcastId,
        lightcastType: skill.lightcastType,
        lightcastDescription: skill.lightcastDescription,
        lightcastApiVersion: skill.lightcastApiVersion,
        lightcastCategoryId: skill.lightcastCategoryId,
        lightcastCategoryName: skill.lightcastCategoryName,
        lightcastSubcategoryId: skill.lightcastSubcategoryId,
        lightcastSubcategoryName: skill.lightcastSubcategoryName,
        skillSource:
          skill.skillSource === "LIGHTCAST" ? "LIGHTCAST" : "CUSTOM",
      })),
    );
    setScreeningQuestions(job.screeningQuestions ?? []);
  }, [job, open]);

  function addCustomSkill(value: string) {
    const name = value.trim();
    if (
      !name ||
      skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())
    ) {
      return;
    }
    setSkills([
      ...skills,
      {
        name,
        kind: "HARD",
        priority: "MUST",
        skillSource: "CUSTOM",
      },
    ]);
  }

  function addCatalogueSkill(skill: CatalogueSkill) {
    if (
      skills.some(
        (item) =>
          item.lightcastId === skill.id ||
          item.name.toLowerCase() === skill.name.toLowerCase(),
      )
    ) {
      return;
    }
    setSkills([
      ...skills,
      {
        name: skill.name,
        kind: skill.type === "Common Skill" ? "SOFT" : "HARD",
        priority: "MUST",
        lightcastId: skill.id,
        lightcastType: skill.type,
        lightcastDescription: skill.description,
        lightcastApiVersion: skill.apiVersion,
        lightcastCategoryId: skill.categoryId,
        lightcastCategoryName: skill.categoryName,
        lightcastSubcategoryId: skill.subcategoryId,
        lightcastSubcategoryName: skill.subcategoryName,
        skillSource: "LIGHTCAST",
      },
    ]);
  }

  function save() {
    const validQuestions = screeningQuestions
      .filter((question) => question.prompt.trim().length >= 3)
      .map((question) => ({
        ...question,
        prompt: question.prompt.trim(),
        options:
          question.type === "SELECT"
            ? question.options.map((option) => option.trim()).filter(Boolean)
            : [],
      }));

    updateJob.mutate({
      id: job.id,
      title: title.trim(),
      department: department.trim(),
      location: location.trim(),
      employmentType,
      seniority,
      description: description.trim(),
      skills,
      screeningQuestions: validQuestions,
    });
  }

  const canSave =
    title.trim().length >= 2 &&
    skills.length > 0 &&
    screeningQuestions.every(
      (question) =>
        question.prompt.trim().length >= 3 &&
        (question.type !== "SELECT" || question.options.length >= 2),
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Pencil className="h-4 w-4" />
          Edit job
        </Button>
      </DialogTrigger>
      <DialogContent className="skilio-interface max-h-[88vh] max-w-3xl overflow-y-auto border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-0">
        <DialogHeader className="border-b border-[var(--skilio-border)] px-6 py-5 pr-14">
          <DialogTitle className="text-xl text-[var(--skilio-ink)]">
            Edit job post
          </DialogTitle>
          <DialogDescription className="text-[var(--skilio-ink-soft)]">
            Changes appear on the public application page immediately.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="role" className="px-6">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] p-1">
            <TabsTrigger value="role">Role</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="screening">Pre-screening</TabsTrigger>
          </TabsList>

          <TabsContent value="role" className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-job-title">Job title</Label>
              <Input
                id="edit-job-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-job-department">Department</Label>
                <Input
                  id="edit-job-department"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-job-location">Location</Label>
                <Input
                  id="edit-job-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Employment type</Label>
                <Select
                  value={employmentType}
                  onValueChange={setEmploymentType}
                >
                  <SelectTrigger className="mt-2">
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
                  <SelectTrigger className="mt-2">
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
            </div>
            <div>
              <Label htmlFor="edit-job-description">Job description</Label>
              <Textarea
                id="edit-job-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 min-h-64 resize-y"
              />
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4 py-4">
            <div>
              <Label>Add a skill</Label>
              <SkillCataloguePicker
                excludedNames={skills.map((skill) => skill.name)}
                onSelect={addCatalogueSkill}
                onAddCustom={addCustomSkill}
              />
            </div>
            <div className="space-y-2">
              {skills.map((skill, index) => (
                <div
                  key={`${skill.name}-${index}`}
                  className="grid gap-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3 sm:grid-cols-[1fr_130px_150px_auto]"
                >
                  <div className="self-center">
                    <div className="font-medium text-[var(--skilio-ink)]">
                      {skill.name}
                    </div>
                    {skill.skillSource === "LIGHTCAST" && (
                      <div className="mt-1 text-xs text-[var(--skilio-ink-muted)]">
                        Skill catalogue
                      </div>
                    )}
                  </div>
                  <Select
                    value={skill.kind}
                    onValueChange={(value) =>
                      setSkills(
                        skills.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, kind: value as SkillDraft["kind"] }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HARD">Hard</SelectItem>
                      <SelectItem value="SOFT">Soft</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={skill.priority}
                    onValueChange={(value) =>
                      setSkills(
                        skills.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                priority: value as SkillDraft["priority"],
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MUST">Must-have</SelectItem>
                      <SelectItem value="NICE">Nice-to-have</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${skill.name}`}
                    onClick={() =>
                      setSkills(
                        skills.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="screening" className="py-4">
            <ScreeningQuestionEditor
              questions={screeningQuestions}
              onChange={setScreeningQuestions}
            />
          </TabsContent>
        </Tabs>

        {updateJob.isError && (
          <p className="mx-6 rounded-[var(--skilio-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {updateJob.error.message}
          </p>
        )}

        <DialogFooter className="border-t border-[var(--skilio-border)] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!canSave || updateJob.isLoading}
            className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
