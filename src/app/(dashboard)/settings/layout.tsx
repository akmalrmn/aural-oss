"use client";

import { SkilioMotionRoot } from "@/components/jobs/skilio-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, Settings, Users } from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const settingsNav: {
    name: string;
    href: string;
    icon: typeof Settings;
    exact?: boolean;
    external?: boolean;
  }[] = [
    {
      name: "General",
      href: "/settings",
      icon: Settings,
      exact: true,
    },
    {
      name: "Members",
      href: "/settings/members",
      icon: Users,
    },
    {
      name: "API keys",
      href: "/settings/api-keys",
      icon: KeyRound,
    },
  ];

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-6xl flex-col gap-5">
      <header
        data-skillio-reveal
        className="flex items-start gap-3 border-b border-[var(--skilio-border)] pb-5 sm:items-center"
      >
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] sm:mt-0">
          <Settings className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold leading-tight text-[var(--skilio-ink)] sm:text-[1.875rem]">
            Workspace settings
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
            Manage workspace details, teammate access, and developer credentials.
          </p>
        </div>
      </header>

      <nav
        data-skillio-reveal
        aria-label="Workspace settings"
        className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-1.5 shadow-[var(--skilio-shadow-1)]"
      >
        <div className="grid grid-cols-3 gap-1.5">
          {settingsNav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-[var(--skilio-radius-md)] px-2 py-2 text-xs font-semibold transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--skilio-panel)] sm:justify-start sm:px-4 sm:text-sm",
                  isActive
                    ? "bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-1)] [&_svg]:text-[var(--skilio-brand)]"
                    : "text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-ink)]",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0">{children}</div>
    </SkilioMotionRoot>
  );
}
