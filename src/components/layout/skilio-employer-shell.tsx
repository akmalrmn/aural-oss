"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useOrg } from "@/components/org-provider";
import { useProject } from "@/components/project-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  { label: "Jobs", href: "/jobs", icon: BriefcaseBusiness, match: ["/jobs"] },
  { label: "Applicants", href: "/applicants", icon: UsersRound, match: ["/applicants"] },
  { label: "Workspace", href: "/settings", icon: Settings, match: ["/settings", "/account"] },
];

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SK"
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-[var(--skilio-border)] bg-[var(--skilio-canvas)] text-[var(--skilio-ink)]">
      <div className="flex h-16 items-center gap-3 border-b border-[var(--skilio-border)] px-4">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-1)]">
          <Image src="/logos/skilio-leaf-square.png" alt="Skilio" width={32} height={32} className="h-8 w-8 object-contain" />
        </div>
        <div className="relative min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide">Skilio Hiring</div>
          <div className="truncate text-xs text-[var(--skilio-ink-muted)]">Employer job portal</div>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1 px-2.5 py-4">
        {navItems.map((item) => {
          const active = item.match.some((prefix) => pathname.startsWith(prefix));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-10 items-center gap-3 rounded-[var(--skilio-radius-md)] px-3 text-sm font-medium transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.99]",
                active
                  ? "bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-1)]"
                  : "text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-ink)]",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-[var(--skilio-border)] p-3">
        <Link
          href="/jobs/new"
          onClick={onNavigate}
          className="flex h-10 items-center justify-center gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] px-3 text-sm font-semibold text-white shadow-[var(--skilio-shadow-1)] transition-[background-color,transform] duration-150 hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New job
        </Link>
      </div>
    </div>
  );
}

export function SkilioEmployerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { currentOrg } = useOrg();
  const { currentProject } = useProject();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = profile?.name || user?.email?.split("@")[0] || "Employer";

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <div className="skilio-interface min-h-screen bg-[var(--skilio-canvas)] text-[var(--skilio-ink)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-[rgba(16,35,63,0.32)]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[var(--skilio-border)] bg-[rgba(244,249,242,0.86)] backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">
                <LayoutDashboard className="h-3.5 w-3.5" />
                {currentOrg?.name ?? "Skilio workspace"}
              </div>
              <div className="truncate text-sm font-semibold text-[var(--skilio-ink)]">
                {currentProject?.name ?? "Hiring workspace"}
              </div>
            </div>
            <Link href="/jobs/new">
              <Button className="hidden h-10 gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white shadow-[var(--skilio-shadow-1)] hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98] sm:inline-flex">
                <Plus className="h-4 w-4" />
                New job
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)]">
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar ?? undefined} />
                    <AvatarFallback className="bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm font-medium sm:block">
                    {displayName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserRound className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Workspace settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} disabled={signingOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
