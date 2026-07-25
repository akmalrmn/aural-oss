"use client";

import { Plus, Trash2 } from "lucide-react";
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

export type ScreeningQuestionDraft = {
  id: string;
  prompt: string;
  type: "TEXT" | "YES_NO" | "SELECT";
  required: boolean;
  options: string[];
};

function createQuestion(): ScreeningQuestionDraft {
  return {
    id: `question-${crypto.randomUUID()}`,
    prompt: "",
    type: "TEXT",
    required: false,
    options: [],
  };
}

export function ScreeningQuestionEditor({
  questions,
  onChange,
}: {
  questions: ScreeningQuestionDraft[];
  onChange: (questions: ScreeningQuestionDraft[]) => void;
}) {
  function updateQuestion(
    index: number,
    patch: Partial<ScreeningQuestionDraft>,
  ) {
    onChange(
      questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );
  }

  return (
    <div className="space-y-5">
      {questions.length === 0 ? (
        <div className="rounded-[var(--skilio-radius-md)] border border-dashed border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] px-5 py-10 text-center">
          <p className="text-sm font-semibold text-[var(--skilio-ink)]">
            No pre-screening questions
          </p>
          <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
            Add only the questions needed to decide who moves to review.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--skilio-border)] border-y border-[var(--skilio-border)]">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="py-5"
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_40px] md:items-end">
                <div>
                  <Label htmlFor={`${question.id}-prompt`}>
                    Question {index + 1}
                  </Label>
                  <Input
                    id={`${question.id}-prompt`}
                    value={question.prompt}
                    onChange={(event) =>
                      updateQuestion(index, { prompt: event.target.value })
                    }
                    placeholder="For example: When can you start?"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor={`${question.id}-type`}>Answer type</Label>
                  <Select
                    value={question.type}
                    onValueChange={(value) =>
                      updateQuestion(index, {
                        type: value as ScreeningQuestionDraft["type"],
                        options: value === "SELECT" ? question.options : [],
                      })
                    }
                  >
                    <SelectTrigger
                      id={`${question.id}-type`}
                      aria-label={`Answer type for question ${index + 1}`}
                      className="mt-2 shadow-none"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Short answer</SelectItem>
                      <SelectItem value="YES_NO">Yes or no</SelectItem>
                      <SelectItem value="SELECT">Multiple choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove question ${index + 1}`}
                  className="text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-danger-soft)] hover:text-[var(--skilio-danger)]"
                  onClick={() =>
                    onChange(
                      questions.filter(
                        (_, questionIndex) => questionIndex !== index,
                      ),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {question.type === "SELECT" && (
                <div className="mt-4">
                  <Label htmlFor={`${question.id}-options`}>
                    Choices, separated by commas
                  </Label>
                  <Input
                    id={`${question.id}-options`}
                    value={question.options.join(", ")}
                    onChange={(event) =>
                      updateQuestion(index, {
                        options: event.target.value
                          .split(",")
                          .map((option) => option.trim())
                          .filter(Boolean)
                          .slice(0, 12),
                      })
                    }
                    placeholder="Immediately, 2 weeks, 1 month"
                  className="mt-2"
                />
              </div>
              )}

              <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-[var(--skilio-ink-soft)]">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(event) =>
                    updateQuestion(index, { required: event.target.checked })
                  }
                  className="h-4 w-4 accent-[var(--skilio-brand)]"
                />
                Required to submit
              </label>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="gap-2 rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
        disabled={questions.length >= 12}
        onClick={() => onChange([...questions, createQuestion()])}
      >
        <Plus className="h-4 w-4" />
        Add question
      </Button>
    </div>
  );
}
