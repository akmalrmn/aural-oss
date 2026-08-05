"use client";

import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { normalizePersonName } from "@/lib/employer-onboarding";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Building2, KeyRound, Loader2, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type VerificationType = "invite" | "magiclink";

type AcceptInviteFormProps = {
  initialCodeLength: number;
  initialEmail: string;
};

export function AcceptInviteForm({
  initialCodeLength,
  initialEmail,
}: AcceptInviteFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [needsVerification, setNeedsVerification] = useState(Boolean(initialEmail));
  const [companyName, setCompanyName] = useState("your company");
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationType, setVerificationType] =
    useState<VerificationType>("invite");
  const [codeLength, setCodeLength] = useState(initialCodeLength);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadInvitationUser = (user: User) => {
    const metadata = user.user_metadata ?? {};
    if (
      typeof metadata.invited_organization_id !== "string" ||
      typeof metadata.invitation_accepted_at === "string"
    ) {
      router.replace("/jobs");
      return false;
    }

    setEmail(user.email ?? email);
    setFullName(typeof metadata.full_name === "string" ? metadata.full_name : "");
    setCompanyName(
      typeof metadata.invited_organization_name === "string"
        ? metadata.invited_organization_name
        : "your company",
    );
    setNeedsVerification(false);
    setCheckingSession(false);
    return true;
  };

  useEffect(() => {
    let mounted = true;

    async function loadInvitation() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (user) {
        loadInvitationUser(user);
        return;
      }

      if (!initialEmail) {
        router.replace("/login?error=invite_session_missing");
        return;
      }

      setNeedsVerification(true);
      setCheckingSession(false);
    }

    void loadInvitation();
    return () => {
      mounted = false;
    };
    // The invitation URL establishes the initial email only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail, router, supabase]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verificationCode.length !== codeLength) return;

    setVerifying(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: verificationCode,
      type: verificationType,
    });

    if (error || !data.user) {
      toast({
        title: "Invitation verification failed",
        description: "The code is invalid or expired. Request a new code and try again.",
        variant: "destructive",
      });
      setVerifying(false);
      return;
    }

    loadInvitationUser(data.user);
    setVerifying(false);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as {
        codeLength?: number;
        error?: string;
        verificationType?: "magiclink";
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
      setCodeLength(result.codeLength ?? 8);
      setVerificationCode("");
      toast({ title: "A new activation code was sent" });
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const normalizedName = normalizePersonName(fullName);
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: {
          full_name: normalizedName,
          invitation_accepted_at: new Date().toISOString(),
        },
      });

      if (error || !data.user) {
        toast({
          title: "Unable to activate your access",
          description: error?.message ?? "Check your details and try again.",
          variant: "destructive",
        });
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ name: normalizedName })
        .eq("id", data.user.id);

      if (profileError) {
        toast({
          title: "Your account is active",
          description: "Your display name could not be saved. You can update it in settings.",
        });
      }

      router.replace("/jobs");
      router.refresh();
    } catch {
      toast({
        title: "Unable to activate your access",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden rounded-[var(--skilio-radius-lg)] border-0 bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-2)]">
      <CardHeader className="space-y-0 px-6 pb-7 pt-6 sm:px-8 sm:pt-8">
        <div className="mb-7 flex items-center gap-3">
          <Image src="/logos/skilio-leaf-square.png" alt="" width={40} height={40} className="h-10 w-10 rounded-[var(--skilio-radius-sm)]" priority />
          <div>
            <p className="text-sm font-semibold text-[var(--skilio-ink)]">Skilio Hiring</p>
            <p className="text-xs text-[var(--skilio-ink-muted)]">Team invitation</p>
          </div>
        </div>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
          {needsVerification ? (
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Building2 className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <h1 className="font-heading text-2xl font-semibold text-[var(--skilio-ink)]">
          {needsVerification ? "Verify your invitation" : `Join ${companyName}`}
        </h1>
        <CardDescription className="mt-2 leading-6 text-[var(--skilio-ink-soft)]">
          {needsVerification ? (
            <>
              Enter the {codeLength}-digit activation code sent to{" "}
              <span className="break-all font-medium text-[var(--skilio-ink)]">
                {email}
              </span>
              .
            </>
          ) : (
            "Create your employer password to access this company’s jobs and applicants."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-8 sm:px-8">
        {checkingSession ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-[var(--skilio-ink-muted)]" role="status">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading invitation
          </div>
        ) : needsVerification ? (
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Activation code</Label>
              <Input
                id="inviteCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={`[0-9]{${codeLength}}`}
                maxLength={codeLength}
                className="h-14 text-center font-mono text-2xl tracking-[0.35em]"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, codeLength))}
                autoFocus
                required
                disabled={verifying}
              />
            </div>
            <Button type="submit" className="h-11 w-full bg-[var(--skilio-brand)] text-white" disabled={verifying || verificationCode.length !== codeLength}>
              {verifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {verifying ? "Verifying…" : "Verify invitation"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={handleResend} disabled={resending || verifying}>
              {resending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              {resending ? "Sending…" : "Send a new code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={saving}>
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Work email</Label>
              <Input id="inviteEmail" value={email} readOnly className="h-11 text-[var(--skilio-ink-soft)]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteName">Your name</Label>
              <Input id="inviteName" autoComplete="name" className="h-11" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={100} disabled={saving} />
            </div>
            <PasswordField id="invitePassword" label="Create password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} helperText="Use at least 8 characters." disabled={saving} />
            <Button type="submit" className="h-11 w-full bg-[var(--skilio-brand)] text-white" disabled={saving || !fullName.trim() || password.length < 8}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "Activating access…" : "Register and join workspace"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
