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
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useAppLocale();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: t("auth.errorTitle"),
          description: t("auth.invalidEmailOrPassword"),
          variant: "destructive",
        });
        setLoading(false);
      } else {
        router.push("/jobs");
        router.refresh();
      }
    } catch {
      toast({
        title: "Unable to sign in",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

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
          Employer sign in
        </h1>
        <CardDescription className="mt-2 leading-6 text-[var(--skilio-ink-soft)]">
          Use your employer account to manage job openings.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-0 sm:px-8">
        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11"
              placeholder={t("auth.emailPlaceholder")}
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
            autoComplete="current-password"
            disabled={loading}
          />

          <Button
            className="h-11 w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white transition-[background-color,transform] hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98]"
            type="submit"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center px-6 pb-6 pt-7 sm:px-8 sm:pb-8">
        <p className="text-sm text-[var(--skilio-ink-muted)]">
          New to Skilio Hiring?{" "}
          <Link
            href="/register"
            className="rounded-sm font-medium text-[var(--skilio-brand-strong)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)]"
          >
            Create company workspace
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
