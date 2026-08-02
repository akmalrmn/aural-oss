"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import type { JobDraft } from "@/lib/jobs/job-draft-schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import styles from "./job-draft-authoring.module.css";

export type JobAuthoringValues = {
  title: string;
  department: string;
  location: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Internship";
  seniority: "Entry-level" | "Mid-level" | "Senior" | "Lead";
  description: string;
};

export type JobDraftApplyField =
  | "title"
  | "department"
  | "location"
  | "employmentType"
  | "seniority"
  | "description"
  | "screeningQuestions";

type GenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: JobAuthoringValues;
  loading: boolean;
  error: string | null;
  onGenerate: (input: Omit<JobAuthoringValues, "description"> & {
    notes: string;
  }) => void;
};

const fieldClass =
  "mt-2 border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink)] shadow-none placeholder:text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-control-strong)] focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-[var(--skilio-elevated)]";

export function GenerateJobDraftDialog({
  open,
  onOpenChange,
  current,
  loading,
  error,
  onGenerate,
}: GenerateDialogProps) {
  const [title, setTitle] = useState(current.title);
  const [department, setDepartment] = useState(current.department);
  const [location, setLocation] = useState(current.location);
  const [employmentType, setEmploymentType] =
    useState<JobAuthoringValues["employmentType"]>(current.employmentType);
  const [seniority, setSeniority] =
    useState<JobAuthoringValues["seniority"]>(current.seniority);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(current.title);
    setDepartment(current.department);
    setLocation(current.location);
    setEmploymentType(current.employmentType);
    setSeniority(current.seniority);
    setNotes(current.description);
  }, [
    current.department,
    current.description,
    current.employmentType,
    current.location,
    current.seniority,
    current.title,
    open,
  ]);

  const canGenerate = title.trim().length >= 2 && !loading;

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent
        aria-busy={loading}
        className={cn(
          styles.dialogShell,
          styles.briefDialog,
          "skilio-interface grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-0 text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-2)] sm:rounded-[var(--skilio-radius-lg)]",
          loading && "[&>button]:hidden",
        )}
      >
        <DialogHeader className="border-b border-[var(--skilio-border)] px-6 pb-5 pt-6 pr-14 text-left">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--skilio-brand-strong)]">
            <Sparkles className="h-4 w-4" />
            Draft with AI
          </div>
          <DialogTitle className="text-2xl font-semibold leading-tight">
            Brief the role
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-xl leading-6 text-[var(--skilio-ink-soft)]">
            Give the hiring context you know. You will review every generated
            field before it changes the job.
          </DialogDescription>
        </DialogHeader>

        <div className="grid overflow-y-auto px-6 py-6 sm:grid-cols-2">
          <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="ai-role-title">Job title</Label>
            <Input
              id="ai-role-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Senior Product Designer"
              className={fieldClass}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="ai-department">Department</Label>
            <Input
              id="ai-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Design"
              className={fieldClass}
            />
          </div>
          <div>
            <Label htmlFor="ai-location">Location</Label>
            <Input
              id="ai-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Remote or Kuala Lumpur"
              className={fieldClass}
            />
          </div>
          <div>
            <Label htmlFor="ai-employment-type">Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(value) =>
                setEmploymentType(
                  value as JobAuthoringValues["employmentType"],
                )
              }
            >
              <SelectTrigger id="ai-employment-type" className={fieldClass}>
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
            <Label htmlFor="ai-seniority">Seniority</Label>
            <Select
              value={seniority}
              onValueChange={(value) =>
                setSeniority(value as JobAuthoringValues["seniority"])
              }
            >
              <SelectTrigger id="ai-seniority" className={fieldClass}>
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
          <div className="sm:col-span-2">
            <Label htmlFor="ai-role-notes">Role outcomes and context</Label>
            <Textarea
              id="ai-role-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What should this person own, deliver, and work with? Include any real requirements that must remain in the draft."
              className={cn(fieldClass, "min-h-36 resize-y")}
            />
            <p className="mt-2 text-xs leading-5 text-[var(--skilio-ink-muted)]">
              Do not include private candidate or employee information. This
              content is processed by Skilio&apos;s configured AI providers.
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="flex gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-danger-soft)] p-4 text-sm text-[var(--skilio-danger)] sm:col-span-2"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Draft generation failed</div>
                <p className="mt-1 leading-5">{error}</p>
              </div>
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--skilio-border)] bg-[var(--skilio-panel)] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canGenerate}
            onClick={() =>
              onGenerate({
                title: title.trim(),
                department: department.trim(),
                location: location.trim(),
                employmentType,
                seniority,
                notes: notes.trim(),
              })
            }
            className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Creating draft..." : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: JobDraft | null;
  sourceLabel: string;
  current: JobAuthoringValues;
  onApply: (fields: Set<JobDraftApplyField>) => void;
};

const REVIEW_FIELDS: Array<{
  key: JobDraftApplyField;
  label: string;
}> = [
  { key: "title", label: "Job title" },
  { key: "department", label: "Department" },
  { key: "location", label: "Location" },
  { key: "employmentType", label: "Employment type" },
  { key: "seniority", label: "Seniority" },
  { key: "description", label: "Job description" },
  { key: "screeningQuestions", label: "Pre-screening questions" },
];

function draftValue(draft: JobDraft, field: JobDraftApplyField) {
  if (field === "screeningQuestions") {
    return draft.screeningQuestions.length
      ? draft.screeningQuestions
          .map((question, index) => {
            const details = [
              question.required ? "Required" : "Optional",
              question.type === "YES_NO"
                ? "Yes / no"
                : question.type === "SELECT"
                  ? "Multiple choice"
                  : "Written answer",
            ].join(" · ");
            const options =
              question.type === "SELECT" && question.options.length
                ? `\n   Options: ${question.options.join(", ")}`
                : "";
            return `${index + 1}. ${question.prompt}\n   ${details}${options}`;
          })
          .join("\n\n")
      : "No questions suggested";
  }
  return draft[field] || "Not provided";
}

function hasDraftValue(draft: JobDraft, field: JobDraftApplyField) {
  if (field === "screeningQuestions") {
    return draft.screeningQuestions.length > 0;
  }
  return Boolean(draft[field]);
}

export function JobDraftReviewDialog({
  open,
  onOpenChange,
  draft,
  sourceLabel,
  current,
  onApply,
}: ReviewDialogProps) {
  const defaultFields = useMemo(
    () =>
      new Set(
        draft
          ? REVIEW_FIELDS.filter(({ key }) => hasDraftValue(draft, key)).map(
              ({ key }) => key,
            )
          : [],
      ),
    [draft],
  );
  const [selected, setSelected] =
    useState<Set<JobDraftApplyField>>(defaultFields);

  useEffect(() => {
    if (open) setSelected(defaultFields);
  }, [defaultFields, open]);

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          styles.dialogShell,
          styles.reviewDialog,
          "skilio-interface grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-0 text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-2)] sm:rounded-[var(--skilio-radius-lg)]",
        )}
      >
        <DialogHeader className="border-b border-[var(--skilio-border)] px-6 pb-5 pt-6 pr-14 text-left">
          <div className="mb-2 text-sm font-medium text-[var(--skilio-brand-strong)]">
            {sourceLabel}
          </div>
          <DialogTitle className="text-2xl font-semibold leading-tight">
            Review the proposed changes
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-2xl leading-6 text-[var(--skilio-ink-soft)]">
            Select the fields to bring into this job. Nothing changes until you
            apply the selection.
          </DialogDescription>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <button
              type="button"
              className="font-medium text-[var(--skilio-brand-strong)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)]"
              onClick={() => setSelected(defaultFields)}
            >
              Select all
            </button>
            <span className="text-[var(--skilio-border-strong)]">/</span>
            <button
              type="button"
              className="font-medium text-[var(--skilio-ink-soft)] hover:text-[var(--skilio-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)]"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto">
          <div className="divide-y divide-[var(--skilio-border)] px-6">
            {REVIEW_FIELDS.filter(({ key }) => hasDraftValue(draft, key)).map(
              ({ key, label }) => {
                const checked = selected.has(key);
                const currentValue =
                  key === "screeningQuestions" ? "" : current[key] ?? "";
                const value = draftValue(draft, key);
                const replacesExisting =
                  Boolean(currentValue) && currentValue !== value;

                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-4 py-4"
                  >
                    <span className="flex min-h-11 min-w-6 items-center">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => {
                          const copy = new Set(selected);
                          if (next) copy.add(key);
                          else copy.delete(key);
                          setSelected(copy);
                        }}
                        aria-label={`Apply ${label}`}
                        className="h-5 w-5 rounded-[var(--skilio-radius-sm)] border-[var(--skilio-border-strong)] data-[state=checked]:border-[var(--skilio-brand)] data-[state=checked]:bg-[var(--skilio-brand)]"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold text-[var(--skilio-ink)]">
                          {label}
                        </span>
                        {replacesExisting && (
                          <span className="text-xs text-[var(--skilio-ink-muted)]">
                            Replaces the current value
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-sm leading-6 text-[var(--skilio-ink-soft)]",
                          (key === "description" ||
                            key === "screeningQuestions") &&
                            "whitespace-pre-line",
                        )}
                      >
                        {value}
                      </span>
                    </span>
                  </label>
                );
              },
            )}
          </div>

          {(draft.skillQueries.length > 0 || draft.warnings.length > 0) && (
            <div className="border-t border-[var(--skilio-border)] bg-[var(--skilio-control)] px-6 py-5">
              {draft.skillQueries.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-[var(--skilio-ink)]">
                    Skills to match in the catalogue
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                    {draft.skillQueries.join(", ")}
                  </p>
                </div>
              )}
              {draft.warnings.length > 0 && (
                <div className={draft.skillQueries.length ? "mt-4" : undefined}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--skilio-ink)]">
                    <AlertCircle className="h-4 w-4 text-[var(--skilio-brand-strong)]" />
                    Check before publishing
                  </div>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                    {draft.warnings.map((warning) => (
                      <li key={warning}>- {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--skilio-border)] bg-[var(--skilio-panel)] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
          >
            Keep current job
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0}
            onClick={() => onApply(selected)}
            className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
          >
            <Check className="h-4 w-4" />
            Apply {selected.size} {selected.size === 1 ? "field" : "fields"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
