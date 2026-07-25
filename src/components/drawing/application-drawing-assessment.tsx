"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  DrawingAssessmentCanvas,
  type DrawingAssessmentCanvasRef,
} from "@/components/drawing/drawing-assessment-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DRAWING_STARTER_SHAPES,
  type ApplicationDrawingResponse,
} from "@/lib/drawing-assessment";
import { cn } from "@/lib/utils";

type DrawingDraft = ApplicationDrawingResponse & {
  snapshotData: string;
};

type ApplicationDrawingAssessmentProps = {
  onChange: (responses: ApplicationDrawingResponse[]) => void;
};

function responseFromDraft(draft: DrawingDraft): ApplicationDrawingResponse {
  return {
    starterShape: draft.starterShape,
    phrase: draft.phrase,
    imageDataUrl: draft.imageDataUrl,
  };
}

export function ApplicationDrawingAssessment({
  onChange,
}: ApplicationDrawingAssessmentProps) {
  const canvasRef = useRef<DrawingAssessmentCanvasRef>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Array<DrawingDraft | undefined>>(
    () => Array(DRAWING_STARTER_SHAPES.length),
  );
  const [phrase, setPhrase] = useState("");
  const [hasDrawing, setHasDrawing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const completeCount = drafts.filter(Boolean).length;
  const showingSummary = activeIndex === DRAWING_STARTER_SHAPES.length;
  const activeShape = DRAWING_STARTER_SHAPES[activeIndex];
  const activeDraft = drafts[activeIndex];
  const canSave = hasDrawing && phrase.trim().length > 0;

  const completedResponses = useMemo(
    () =>
      drafts
        .filter((draft): draft is DrawingDraft => Boolean(draft))
        .map(responseFromDraft),
    [drafts],
  );

  function publish(nextDrafts: Array<DrawingDraft | undefined>) {
    const responses = nextDrafts
      .filter((draft): draft is DrawingDraft => Boolean(draft))
      .map(responseFromDraft);
    onChange(responses);
  }

  function openDrawing(index: number) {
    const draft = drafts[index];
    setActiveIndex(index);
    setPhrase(draft?.phrase ?? "");
    setHasDrawing(Boolean(draft));
    setShowValidation(false);
  }

  function saveAndContinue() {
    const submission = canvasRef.current?.getSubmission();
    if (!submission || !phrase.trim()) {
      setShowValidation(true);
      return;
    }

    const nextDrafts = [...drafts];
    nextDrafts[activeIndex] = {
      starterShape: activeShape.value,
      phrase: phrase.trim(),
      imageDataUrl: submission.imageDataUrl,
      snapshotData: submission.snapshotData,
    };
    setDrafts(nextDrafts);
    publish(nextDrafts);

    const nextIndex = activeIndex + 1;
    if (nextIndex === DRAWING_STARTER_SHAPES.length) {
      setActiveIndex(nextIndex);
      return;
    }
    openDrawing(nextIndex);
  }

  function goBack() {
    if (activeIndex === 0) return;
    openDrawing(activeIndex - 1);
  }

  if (showingSummary) {
    return (
      <section data-testid="drawmetrics-summary" className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-[var(--skilio-border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--skilio-brand-strong)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)]">
                <Check className="h-4 w-4" />
              </span>
              All drawings complete
            </div>
            <p className="mt-2 text-sm text-[var(--skilio-ink-soft)]">
              Review the ten drawings and phrases before continuing.
            </p>
          </div>
          <div className="text-sm font-semibold tabular-nums text-[var(--skilio-ink)]">
            {completeCount} / {DRAWING_STARTER_SHAPES.length}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {completedResponses.map((response, index) => (
            <button
              key={response.starterShape}
              type="button"
              data-testid="drawmetrics-summary-response"
              onClick={() => openDrawing(index)}
              className="group grid grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-3 text-left transition-colors hover:border-[var(--skilio-border-strong)] hover:bg-[var(--skilio-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--skilio-radius-sm)] bg-white shadow-[inset_0_0_0_1px_rgba(16,38,28,0.08)]">
                <Image
                  src={response.imageDataUrl}
                  alt={`${response.phrase} drawing`}
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <span className="min-w-0 py-1">
                <span className="block text-[11px] font-semibold uppercase text-[var(--skilio-ink-muted)]">
                  {index + 1}. {DRAWING_STARTER_SHAPES[index].label}
                </span>
                <span className="mt-2 block break-words text-sm font-semibold text-[var(--skilio-ink)]">
                  {response.phrase}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--skilio-brand-strong)]">
                  <PencilLine className="h-3.5 w-3.5" />
                  Edit
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section data-testid="drawmetrics-assessment" className="space-y-5">
      <div className="grid gap-4 border-b border-[var(--skilio-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="text-xs font-semibold uppercase text-[var(--skilio-ink-muted)]">
            Drawing {activeIndex + 1} of {DRAWING_STARTER_SHAPES.length}
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[var(--skilio-ink)]">
            Turn the {activeShape.label.toLowerCase()} into a picture
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
            Continue the fixed grey mark in any way you choose, then name what
            you created. There is no prescribed answer.
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label="Drawing progress">
          {DRAWING_STARTER_SHAPES.map((shape, index) => (
            <span
              key={shape.value}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[var(--skilio-radius-sm)] text-[11px] font-semibold tabular-nums",
                index === activeIndex
                  ? "bg-[var(--skilio-brand)] text-white"
                  : drafts[index]
                    ? "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                    : "bg-[var(--skilio-control)] text-[var(--skilio-ink-muted)]",
              )}
            >
              {drafts[index] ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
          ))}
        </div>
      </div>

      <DrawingAssessmentCanvas
        key={activeShape.value}
        ref={canvasRef}
        starterShape={activeShape.value}
        initialData={activeDraft?.snapshotData}
        onContentChange={setHasDrawing}
        className="min-h-[430px]"
      />

      <div className="space-y-2">
        <Label htmlFor={`drawing-phrase-${activeIndex}`}>
          What did you draw?
        </Label>
        <Input
          id={`drawing-phrase-${activeIndex}`}
          data-testid="drawing-phrase"
          value={phrase}
          maxLength={120}
          onChange={(event) => {
            setPhrase(event.target.value);
            setShowValidation(false);
          }}
          placeholder="For example: a kite in the wind"
          autoComplete="off"
        />
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "text-xs",
              showValidation
                ? "font-medium text-[var(--skilio-danger)]"
                : "text-[var(--skilio-ink-muted)]",
            )}
          >
            {showValidation
              ? "Add lines to the drawing and enter a phrase to continue."
              : "Use a short phrase that describes the completed picture."}
          </p>
          <span className="shrink-0 text-xs tabular-nums text-[var(--skilio-ink-muted)]">
            {phrase.length}/120
          </span>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--skilio-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={activeIndex === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous drawing
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {activeDraft && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                canvasRef.current?.reset();
                setPhrase("");
                setHasDrawing(false);
                setShowValidation(false);
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Start this drawing again
            </Button>
          )}
          <Button
            type="button"
            data-testid="save-drawing-response"
            onClick={saveAndContinue}
            disabled={!canSave}
            className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
          >
            {activeIndex === DRAWING_STARTER_SHAPES.length - 1
              ? "Review drawings"
              : "Save and next"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
