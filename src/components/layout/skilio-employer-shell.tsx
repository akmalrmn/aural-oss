"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  FolderKanban,
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
  { label: "Jobs", href: "/jobs", icon: BriefcaseBusiness, match: ["/jobs"] },
  { label: "Applicants", href: "/applicants", icon: UsersRound, match: ["/applicants"] },
  {
    label: "Assessments",
    href: "/dashboard",
    icon: ClipboardCheck,
    match: ["/dashboard", "/interviews", "/candidates", "/questions", "/practices"],
  },
  { label: "Projects", href: "/projects", icon: FolderKanban, match: ["/projects"] },
  { label: "Settings", href: "/settings", icon: Settings, match: ["/settings", "/org"] },
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
    <div className="flex h-full flex-col bg-[#0e2148] text-white">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7bc957] text-sm font-black text-[#0e2148]">
          S
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide">Skilio</div>
          <div className="truncate text-xs text-white/55">Employer portal</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {navItems.map((item) => {
          const active = item.match.some((prefix) => pathname.startsWith(prefix));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-[#0e2148] shadow-sm"
                  : "text-white/72 hover:bg-white/10 hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/jobs/new"
          onClick={onNavigate}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7bc957] px-3 text-sm font-semibold text-[#0e2148] transition hover:bg-[#8fd86c]"
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
    <div className="min-h-screen bg-[#f6f8f5] text-[#14213d]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-[#0e2148]/45"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[#dde6d9] bg-white/92 backdrop-blur">
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
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[#5d6f5a]">
                <LayoutDashboard className="h-3.5 w-3.5" />
                {currentOrg?.name ?? "Skilio workspace"}
              </div>
              <div className="truncate text-sm font-semibold text-[#14213d]">
                {currentProject?.name ?? "Select a project"}
              </div>
            </div>
            <Link href="/jobs/new">
              <Button className="hidden gap-2 bg-[#2f7d4f] text-white hover:bg-[#256a42] sm:inline-flex">
                <Plus className="h-4 w-4" />
                New job
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="text-[#31425f]">
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar ?? undefined} />
                    <AvatarFallback className="bg-[#dff0d7] text-[#24533b]">
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
                    Settings
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

        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
