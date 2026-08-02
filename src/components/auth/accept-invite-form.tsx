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
import { Building2, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function AcceptInviteForm() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [companyName, setCompanyName] = useState("your company");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadInvitation() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (!user) {
        router.replace("/login?error=invite_session_missing");
        return;
      }

      const metadata = user.user_metadata ?? {};
      if (
        typeof metadata.invited_organization_id !== "string" ||
        typeof metadata.invitation_accepted_at === "string"
      ) {
        router.replace("/jobs");
        return;
      }

      setEmail(user.email ?? "");
      setFullName(
        typeof metadata.full_name === "string" ? metadata.full_name : "",
      );
      setCompanyName(
        typeof metadata.invited_organization_name === "string"
          ? metadata.invited_organization_name
          : "your company",
      );
      setCheckingSession(false);
    }

    void loadInvitation();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

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
          description:
            "Your display name could not be saved. You can update it in settings.",
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
              Team invitation
            </p>
          </div>
        </div>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-2xl font-semibold leading-tight text-[var(--skilio-ink)]">
          Join {companyName}
        </h1>
        <CardDescription className="mt-2 leading-6 text-[var(--skilio-ink-soft)]">
          Set your employer password to access this company&apos;s jobs and
          applicants.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-8 sm:px-8">
        {checkingSession ? (
          <div
            className="flex min-h-40 items-center justify-center text-sm text-[var(--skilio-ink-muted)]"
            role="status"
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading invitation
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={saving}>
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Work email</Label>
              <Input
                id="inviteEmail"
                value={email}
                readOnly
                className="h-11 text-[var(--skilio-ink-soft)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteName">Your name</Label>
              <Input
                id="inviteName"
                name="name"
                autoComplete="name"
                className="h-11"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                maxLength={100}
                disabled={saving}
              />
            </div>
            <PasswordField
              id="invitePassword"
              label="Create password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
              helperText="Use at least 8 characters."
              disabled={saving}
            />
            <Button
              type="submit"
              className="h-11 w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)] active:scale-[0.98]"
              disabled={saving || !fullName.trim() || password.length < 8}
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {saving ? "Activating access…" : "Join company workspace"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
