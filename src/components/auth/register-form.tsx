"use client";

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
import { ArrowLeft, KeyRound, Loader2, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type VerificationType = "signup" | "magiclink";

export function RegisterForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationType, setVerificationType] =
    useState<VerificationType>("signup");
  const [verificationCodeLength, setVerificationCodeLength] = useState(8);

  const supabase = createClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, email, fullName, password }),
      });
      const result = (await response.json()) as {
        error?: string;
        email?: string;
        verificationType?: VerificationType;
        codeLength?: number;
      };

      if (!response.ok || !result.email) {
        toast({
          title: "Unable to create your account",
          description: result.error ?? "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      setVerificationEmail(result.email);
      setVerificationType(result.verificationType ?? "signup");
      setVerificationCodeLength(result.codeLength ?? 8);
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

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = verificationCode
      .replace(/\D/g, "")
      .slice(0, verificationCodeLength);

    if (code.length !== verificationCodeLength) {
      toast({
        title: "Enter the verification code",
        description: `The code contains ${verificationCodeLength} digits.`,
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: verificationEmail,
      token: code,
      type: verificationType,
    });

    if (error) {
      toast({
        title: "Verification failed",
        description: "The code is invalid or expired. Request a new code and try again.",
        variant: "destructive",
      });
      setVerifying(false);
      return;
    }

    window.location.href = "/jobs";
  };

  const handleResend = async () => {
    setResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const result = (await response.json()) as {
        error?: string;
        verificationType?: VerificationType;
        codeLength?: number;
      };

      if (!response.ok) {
        toast({
          title: "Unable to resend code",
          description: result.error ?? "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      setVerificationType(result.verificationType ?? "magiclink");
      setVerificationCodeLength(result.codeLength ?? 8);
      setVerificationCode("");
      toast({ title: "A new verification code was sent" });
    } catch {
      toast({
        title: "Unable to resend code",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  if (verificationEmail) {
    return (
      <Card className="overflow-hidden rounded-[var(--skilio-radius-lg)] border-0 bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-2)]">
        <CardHeader className="items-center px-6 pb-6 pt-8 text-center sm:px-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--skilio-ink)]">
            Verify your work email
          </h1>
          <CardDescription className="mt-2 max-w-sm leading-6 text-[var(--skilio-ink-soft)]">
            Enter the {verificationCodeLength}-digit code sent to{" "}
            <span className="break-all font-medium text-[var(--skilio-ink)]">
              {verificationEmail}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Verification code</Label>
              <Input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={`[0-9]{${verificationCodeLength}}`}
                maxLength={verificationCodeLength}
                className="h-14 text-center font-mono text-2xl tracking-[0.45em]"
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, verificationCodeLength),
                  )
                }
                autoFocus
                required
                disabled={verifying}
              />
            </div>
            <Button
              className="h-11 w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
              type="submit"
              disabled={verifying}
            >
              {verifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {verifying ? "Verifying…" : "Verify and continue"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-3 px-6 pb-8 pt-6 sm:px-8">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleResend}
            disabled={resending || verifying}
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {resending ? "Sending…" : "Send a new code"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-[var(--skilio-ink-muted)]"
            onClick={() => {
              setVerificationEmail("");
              setVerificationCode("");
            }}
            disabled={verifying}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Change registration details
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-[var(--skilio-radius-lg)] border-0 bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-2)]">
      <CardHeader className="space-y-0 px-6 pb-7 pt-6 sm:px-8 sm:pt-8">
        <div className="mb-7 flex items-center gap-3">
          <Image src="/logos/skilio-leaf-square.png" alt="" width={40} height={40} className="h-10 w-10 rounded-[var(--skilio-radius-sm)]" priority />
          <div>
            <p className="text-sm font-semibold text-[var(--skilio-ink)]">Skilio Hiring</p>
            <p className="text-xs text-[var(--skilio-ink-muted)]">Employer access</p>
          </div>
        </div>
        <h1 className="font-heading text-2xl font-semibold text-[var(--skilio-ink)]">
          Create your company workspace
        </h1>
        <CardDescription className="mt-2 leading-6 text-[var(--skilio-ink-soft)]">
          Register directly with Skilio Hiring. No portfolio account is required.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-0 sm:px-8">
        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Your name</Label>
            <Input id="fullName" name="name" autoComplete="name" className="h-11" placeholder="Alex Morgan" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={100} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input id="companyName" name="organization" autoComplete="organization" className="h-11" placeholder="ABC Company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required maxLength={100} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className="h-11" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
          </div>
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} helperText="Use at least 8 characters." disabled={loading} />
          <Button className="h-11 w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]" type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Sending code…" : "Create company workspace"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center px-6 pb-6 pt-7 sm:px-8 sm:pb-8">
        <p className="text-sm text-[var(--skilio-ink-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--skilio-brand-strong)] hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
