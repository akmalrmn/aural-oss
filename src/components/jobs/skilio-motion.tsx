"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

export function SkilioMotionRoot({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-skillio-reveal]");
      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: "power2.out",
          stagger: 0.035,
        },
      );

      gsap.utils.toArray<HTMLElement>("[data-skillio-scroll]").forEach((item) => {
        gsap.fromTo(
          item,
          { autoAlpha: 0.35, scale: 0.96 },
          {
            autoAlpha: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: item,
              start: "top 88%",
              end: "bottom 58%",
              scrub: true,
            },
          },
        );
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      data-skillio-motion-root
      className={cn("w-full min-w-0 max-w-full overflow-x-clip", className)}
    >
      {children}
    </div>
  );
}

export function SkilioPanel({
  children,
  className,
  scroll,
}: {
  children: React.ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <div
      data-skillio-reveal
      data-skillio-scroll={scroll ? "" : undefined}
      className={cn(
        "overflow-hidden rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-1)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SkilioHero({
  title,
  description,
  action,
  aside,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section
      data-skillio-reveal
      className="relative overflow-hidden rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-4 text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-1)] sm:p-5"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--skilio-signal)]" />
      <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="pl-3">
          <h1 className="max-w-4xl text-[clamp(1.75rem,3vw,2.6rem)] font-semibold leading-[1.04] text-[var(--skilio-ink)]">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--skilio-ink-soft)] sm:text-[15px]">
            {description}
          </p>
          {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
        </div>
        {aside && (
          <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-3 shadow-[var(--skilio-shadow-1)]">
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
