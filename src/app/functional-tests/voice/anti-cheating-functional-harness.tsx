"use client";

import { useAntiCheating } from "@/hooks/use-anti-cheating";

export function AntiCheatingFunctionalHarness() {
  const { violations } = useAntiCheating({ enabled: true });

  return (
    <main>
      <label htmlFor="anti-cheating-test-input">Interview answer</label>
      <textarea id="anti-cheating-test-input" defaultValue="Internal answer" />
      <output data-testid="anti-cheating-ready">ready</output>
      <output data-testid="anti-cheating-violations">
        {violations.length}
      </output>
    </main>
  );
}
