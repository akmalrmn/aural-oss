"use client";

import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
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
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <SkilioHero
        title="Configure the hiring room."
        description="Manage the workspace, teammates, and API access used by job postings and applicant review."
      />

      <SkilioPanel className="p-2">
        <nav className="grid gap-2 sm:grid-cols-3">
          {settingsNav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-[var(--skilio-radius-md)] px-4 py-3 text-sm font-semibold transition-[background-color,box-shadow,color] duration-150",
                  isActive
                    ? "bg-[var(--skilio-ink)] text-white shadow-[var(--skilio-shadow-1)]"
                    : "bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control-strong)] hover:text-[var(--skilio-ink)]",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </SkilioPanel>

      <div className="min-w-0">{children}</div>
    </SkilioMotionRoot>
  );
}
