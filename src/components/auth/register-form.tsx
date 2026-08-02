"use client";

import { useAppLocale } from "@/components/app-locale-provider";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { buildEmployerSignupMetadata } from "@/lib/employer-onboarding";
import { createClient } from "@/lib/supabase/client";
import { Loader2, MailCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function RegisterForm() {
  const { toast } = useToast();
  const { t } = useAppLocale();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: buildEmployerSignupMetadata({ companyName, fullName }),
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/jobs`,
        },
      });

      if (error) {
        toast({
          title: t("auth.registrationFailed"),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user?.identities?.length === 0) {
        toast({
          title: t("auth.accountExists"),
          description: t("auth.accountExistsDescription"),
          variant: "destructive",
        });
        return;
      }

      if (data.session) {
        window.location.href = "/jobs";
        return;
      }

      setPendingConfirmationEmail(email);
    } catch {
      toast({
        title: "Unable to create your account",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (pendingConfirmationEmail) {
    return (
      <Card className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 overflow-hidden rounded-[var(--skilio-radius-lg)] border-0 bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-2)] motion-safe:duration-300">
        <CardHeader className="items-center px-6 pb-6 pt-8 text-center sm:px-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.01em] text-[var(--skilio-ink)]">
            Check your email
          </h1>
          <CardDescription className="mt-2 max-w-sm leading-6 text-[var(--skilio-ink-soft)]">
            We sent a confirmation link to{" "}
            <span className="break-all font-medium text-[var(--skilio-ink)]">
              {pendingConfirmationEmail}
            </span>
            . Open it to activate the {companyName.trim()} hiring workspace.
          </CardDescription>
        </CardHeader>
        <CardFooter className="px-6 pb-8 sm:px-8">
          <Button
            asChild
            className="h-11 w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
          >
            <Link href="/login">Return to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 overflow-hidden rounded-[var(--skilio-radius-lg)] border-0 bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-2)] motion-safe:duration-300">
      <CardHeader className="space-y-0 px-6 pb-7 pt-6 sm:px-8 sm:pt-8">
        <div className="mb-7 flex items-center gap-3">
          <Image
            src="/logos/skilio-leaf-square.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-[var(--skilio-radius-sm)]"
            priority
          />
          <div>
            <p className="text-sm font-semibold leading-5 text-[var(--skilio-ink)]">
              Skilio Hiring
            </p>
            <p className="text-xs leading-5 text-[var(--skilio-ink-muted)]">
              Employer access
            </p>
          </div>
        </div>
        <h1 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.01em] text-[var(--skilio-ink)]">
          Create your company workspace
        </h1>
        <CardDescription className="mt-2 leading-6 text-[var(--skilio-ink-soft)]">
          Set up your employer account and invite your hiring team after sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-0 sm:px-8">
        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Your name</Label>
            <Input
              id="fullName"
              name="name"
              type="text"
              autoComplete="name"
              className="h-11"
              placeholder="Alex Morgan"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              maxLength={100}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              name="organization"
              type="text"
              autoComplete="organization"
              className="h-11"
              placeholder="ABC Company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
              maxLength={100}
              disabled={loading}
            />
            <p className="text-xs leading-5 text-[var(--skilio-ink-muted)]">
              This becomes your team&apos;s shared organization in Skilio Hiring.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <PasswordField
            label={t("auth.password")}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
            helperText="Use at least 8 characters."
            disabled={loading}
          />

          <Button
            className="h-11 w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white transition-[background-color,transform] hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98]"
            type="submit"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Creating workspace…" : "Create company workspace"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center px-6 pb-6 pt-7 sm:px-8 sm:pb-8">
        <p className="text-sm text-[var(--skilio-ink-muted)]">
          {t("auth.haveAccount")}{" "}
          <Link
            href="/login"
            className="rounded-sm font-medium text-[var(--skilio-brand-strong)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)]"
          >
            {t("auth.signIn")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
