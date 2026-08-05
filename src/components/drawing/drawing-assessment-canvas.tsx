"use client";

import { Button } from "@/components/ui/button";
import {
  type DrawingAssessmentSnapshot,
  type DrawingStarterShape,
  type DrawingStroke,
} from "@/lib/drawing-assessment";
import { cn } from "@/lib/utils";
import { RotateCcw, Undo2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface DrawingAssessmentCanvasRef {
  hasContent: () => boolean;
  reset: () => void;
  getSubmission: () => {
    snapshotData: string;
    imageDataUrl: string;
  } | null;
}

interface DrawingAssessmentCanvasProps {
  starterShape: DrawingStarterShape;
  initialData?: string | null;
  className?: string;
  onContentChange?: (hasContent: boolean) => void;
}

function drawStarterMark(
  context: CanvasRenderingContext2D,
  shape: DrawingStarterShape,
  width: number,
  height: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height) * 0.19;

  context.save();
  context.strokeStyle = "#7d8c83";
  context.fillStyle = "#7d8c83";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();

  switch (shape) {
    case "CIRCLE":
      context.arc(cx, cy, size, 0, Math.PI * 2);
      break;
    case "DIAMOND":
      context.moveTo(cx, cy - size);
      context.lineTo(cx + size, cy);
      context.lineTo(cx, cy + size);
      context.lineTo(cx - size, cy);
      context.closePath();
      break;
    case "CROSS":
      context.moveTo(cx - size, cy - size);
      context.lineTo(cx + size, cy + size);
      context.moveTo(cx + size, cy - size);
      context.lineTo(cx - size, cy + size);
      break;
    case "SQUARE":
      context.rect(cx - size, cy - size, size * 2, size * 2);
      break;
    case "TEE":
      context.moveTo(cx - size, cy - size * 0.75);
      context.lineTo(cx + size, cy - size * 0.75);
      context.moveTo(cx, cy - size * 0.75);
      context.lineTo(cx, cy + size);
      break;
    case "TRIANGLE":
      context.moveTo(cx, cy - size);
      context.lineTo(cx + size, cy + size);
      context.lineTo(cx - size, cy + size);
      context.closePath();
      break;
    case "DOT":
      context.arc(cx, cy, 7, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    case "HEXAGON":
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 3) * index;
        const x = cx + Math.cos(angle) * size;
        const y = cy + Math.sin(angle) * size;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      break;
    case "SLOPE":
      context.moveTo(cx - size, cy + size * 0.65);
      context.lineTo(cx + size, cy - size * 0.65);
      break;
    case "LINE":
      context.moveTo(cx - size, cy);
      context.lineTo(cx + size, cy);
      break;
  }

  context.stroke();
  context.restore();
}

function drawUserStrokes(
  context: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  width: number,
  height: number,
) {
  context.save();
  context.strokeStyle = "#10261c";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    context.beginPath();
    context.moveTo(stroke[0].x * width, stroke[0].y * height);
    for (const point of stroke.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    if (stroke.length === 1) {
      context.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height + 0.1);
    }
    context.stroke();
  }

  context.restore();
}

export const DrawingAssessmentCanvas = forwardRef<
  DrawingAssessmentCanvasRef,
  DrawingAssessmentCanvasProps
>(function DrawingAssessmentCanvas(
  { starterShape, initialData, className, onContentChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  const activeStrokeRef = useRef<DrawingStroke | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);

  useEffect(() => {
    if (!initialData) return;
    try {
      const parsed = JSON.parse(initialData) as Partial<DrawingAssessmentSnapshot>;
      if (Array.isArray(parsed.strokes)) {
        strokesRef.current = parsed.strokes;
        setStrokeCount(parsed.strokes.length);
        onContentChange?.(parsed.strokes.length > 0);
      }
    } catch {
      // Ignore malformed resume data and present a clean canvas.
    }
  }, [initialData, onContentChange]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, rect.width, rect.height);
    drawStarterMark(context, starterShape, rect.width, rect.height);
    drawUserStrokes(context, strokesRef.current, rect.width, rect.height);
    if (activeStrokeRef.current) {
      drawUserStrokes(context, [activeStrokeRef.current], rect.width, rect.height);
    }
  }, [starterShape]);

  useEffect(() => {
    renderCanvas();
    const observer = new ResizeObserver(renderCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderCanvas, strokeCount]);

  const pointFromEvent = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      activeStrokeRef.current = [pointFromEvent(event)];
      renderCanvas();
    },
    [pointFromEvent, renderCanvas],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeStrokeRef.current) return;
      activeStrokeRef.current.push(pointFromEvent(event));
      renderCanvas();
    },
    [pointFromEvent, renderCanvas],
  );

  const commitStroke = useCallback(() => {
    if (!activeStrokeRef.current) return;
    strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
    activeStrokeRef.current = null;
    setStrokeCount(strokesRef.current.length);
    onContentChange?.(true);
    renderCanvas();
  }, [onContentChange, renderCanvas]);

  const undo = useCallback(() => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    onContentChange?.(strokesRef.current.length > 0);
    renderCanvas();
  }, [onContentChange, renderCanvas]);

  const clear = useCallback(() => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    onContentChange?.(false);
    renderCanvas();
  }, [onContentChange, renderCanvas]);

  useImperativeHandle(
    ref,
    () => ({
      hasContent: () => strokesRef.current.length > 0,
      reset: clear,
      getSubmission: () => {
        const canvas = canvasRef.current;
        if (!canvas || strokesRef.current.length === 0) return null;
        const snapshot: DrawingAssessmentSnapshot = {
          assessmentMode: "DRAWING",
          starterShape,
          score: null,
          scoreMode: "UNSCORED",
          strokes: strokesRef.current,
        };
        return {
          snapshotData: JSON.stringify(snapshot),
          imageDataUrl: canvas.toDataURL("image/png"),
        };
      },
    }),
    [clear, starterShape],
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          The grey mark is fixed. Your lines appear in dark ink.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={strokeCount === 0}
            className="h-9 gap-1.5"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={strokeCount === 0}
            className="h-9 gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative min-h-[360px] flex-1 overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      >
        <canvas
          ref={canvasRef}
          data-testid="drawing-assessment-canvas"
          aria-label="Drawing assessment canvas"
          className="absolute inset-0 cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commitStroke}
          onPointerCancel={commitStroke}
        />
      </div>
    </div>
  );
});
