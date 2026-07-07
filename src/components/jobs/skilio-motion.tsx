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
        { autoAlpha: 0, y: 22, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.06,
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
    <div ref={root} className={cn("w-full max-w-full overflow-x-hidden", className)}>
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
        "group overflow-hidden rounded-2xl border border-[#dfe8db] bg-white/95 shadow-[0_24px_80px_rgba(14,33,72,0.08)] transition-transform duration-500 hover:-translate-y-0.5",
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
      className="relative isolate overflow-hidden rounded-3xl bg-[#0e2148] px-5 py-8 text-white shadow-[0_28px_120px_rgba(14,33,72,0.28)] sm:px-8 lg:px-10"
    >
      <div
        className="absolute inset-0 -z-10 opacity-30 mix-blend-luminosity"
        style={{
          backgroundImage: "url('https://picsum.photos/seed/skilio-hiring-console/1920/1080')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_20%,rgba(123,201,87,0.36),transparent_32%),linear-gradient(120deg,rgba(14,33,72,0.92),rgba(14,33,72,0.72))]" />
      <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="max-w-5xl">
          <h1 className="text-[clamp(2.25rem,4vw,4.35rem)] font-semibold leading-[1] tracking-normal">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/78 sm:text-lg">
            {description}
          </p>
          {action && <div className="mt-7 flex flex-wrap gap-3">{action}</div>}
        </div>
        {aside && (
          <div className="rounded-2xl border border-white/14 bg-white/10 p-4 backdrop-blur-xl">
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
