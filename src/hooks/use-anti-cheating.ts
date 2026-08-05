"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AntiCheatingViolation {
  type: "page_departure" | "paste" | "multi_screen";
  timestamp: number;
  detail?: string;
}

interface UseAntiCheatingOptions {
  enabled: boolean;
  onViolation?: (violation: AntiCheatingViolation) => void;
}

interface UseAntiCheatingResult {
  violations: AntiCheatingViolation[];
  departureCount: number;
  multiScreenDetected: boolean;
}

export function useAntiCheating({
  enabled,
  onViolation,
}: UseAntiCheatingOptions): UseAntiCheatingResult {
  const [violations, setViolations] = useState<AntiCheatingViolation[]>([]);
  const [departureCount, setDepartureCount] = useState(0);
  const [multiScreenDetected, setMultiScreenDetected] = useState(false);
  const multiScreenDetectedRef = useRef(false);
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const addViolation = useCallback((violation: AntiCheatingViolation) => {
    setViolations((prev) => [...prev, violation]);
    onViolationRef.current?.(violation);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    const recordDeparture = () => {
      setDepartureCount((prev) => prev + 1);
      addViolation({
        type: "page_departure",
        timestamp: Date.now(),
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (blurTimer) {
          clearTimeout(blurTimer);
          blurTimer = null;
        }
        recordDeparture();
      }
    };

    const handleBlur = () => {
      blurTimer = setTimeout(() => {
        blurTimer = null;
        recordDeparture();
      }, 200);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, addViolation]);

  useEffect(() => {
    if (!enabled) return;

    const internalCopies = new Set<string>();

    const trackText = (text: string | undefined | null) => {
      const trimmed = text?.trim();
      if (trimmed) internalCopies.add(trimmed);
    };

    const getSelectionText = (): string => {
      const sel = window.getSelection()?.toString()?.trim();
      if (sel) return sel;
      const el = document.activeElement;
      if (
        (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) &&
        el.selectionStart != null &&
        el.selectionEnd != null
      ) {
        return el.value.substring(el.selectionStart, el.selectionEnd).trim();
      }
      return "";
    };

    const handleCopy = (e: ClipboardEvent) => {
      trackText(getSelectionText());
      trackText(e.clipboardData?.getData("text/plain"));

      // Some editors populate clipboardData in their own target handler. Read
      // it once more after the event has finished without replacing browser
      // native clipboard methods, which may be read-only or unavailable.
      queueMicrotask(() => {
        trackText(getSelectionText());
        trackText(e.clipboardData?.getData("text/plain"));
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData("text/plain")?.trim() ?? "";
      if (!pastedText || internalCopies.has(pastedText)) return;
      e.preventDefault();
      e.stopPropagation();
      addViolation({
        type: "paste",
        timestamp: Date.now(),
        detail: "External content pasted",
      });
    };

    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("cut", handleCopy, true);
    document.addEventListener("paste", handlePaste, true);

    return () => {
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("cut", handleCopy, true);
      document.removeEventListener("paste", handlePaste, true);
    };
  }, [enabled, addViolation]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const reportMultipleScreens = (detail: string) => {
      if (!active || multiScreenDetectedRef.current) return;
      multiScreenDetectedRef.current = true;
      setMultiScreenDetected(true);
      addViolation({
        type: "multi_screen",
        timestamp: Date.now(),
        detail,
      });
    };

    const checkScreens = () => {
      try {
        const screen = window.screen as Screen & { availLeft?: number };
        const hasMultiple =
          screen.availWidth > screen.width ||
          (screen.availLeft !== undefined && screen.availLeft !== 0);

        if (hasMultiple) {
          reportMultipleScreens(
            `Multiple screens detected (${screen.availWidth}x${screen.availHeight})`,
          );
        }
      } catch {
        // Screen geometry is a best-effort fallback and is not exposed by all
        // browsers or embedded webviews.
      }
    };

    const screenDetailsApi = (
      window as unknown as {
        getScreenDetails?: () => Promise<{ screens?: unknown[] }>;
      }
    ).getScreenDetails;
    if (typeof screenDetailsApi === "function") {
      void (async () => {
        try {
          const details = await screenDetailsApi.call(window);
          const screenCount = details?.screens?.length ?? 0;
          if (screenCount > 1) {
            reportMultipleScreens(
              `${screenCount} screens detected via Screen API`,
            );
          }
        } catch {
          checkScreens();
        }
      })();
    } else {
      checkScreens();
    }

    const interval = setInterval(checkScreens, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [enabled, addViolation]);

  return { violations, departureCount, multiScreenDetected };
}
