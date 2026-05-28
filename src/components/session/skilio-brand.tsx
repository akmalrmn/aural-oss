import Image from "next/image";
import type React from "react";

export function SkilioLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logos/skilio-logo.png"
      alt="Skilio"
      width={112}
      height={32}
      className={className}
      priority
    />
  );
}

export function SkilioBrandHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-card px-4 sm:px-6">
      <SkilioLogo className="h-8 w-auto" />
    </header>
  );
}

export function SkilioCandidateShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`skilio-assessment-theme ${className}`}>
      {children}
    </div>
  );
}
