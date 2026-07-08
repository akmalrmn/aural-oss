"use client";

import { useAppLocale } from "@/components/app-locale-provider";
import { useAuth } from "@/components/auth-provider";
import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function AccountPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useAppLocale();

  const [displayName, setDisplayName] = useState(profile?.name ?? "");

  useEffect(() => {
    if (profile?.name != null) {
      setDisplayName(profile.name);
    }
  }, [profile?.name]);

  const [passwordStep, setPasswordStep] = useState<"idle" | "form">("idle");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createClient();

  const resetPasswordState = () => {
    setPasswordStep("idle");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({
        title: t("auth.passwordTooShort"),
        description: t("auth.passwordTooShortDescription"),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("auth.passwordMismatch"), variant: "destructive" });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: t("account.failedToUpdatePassword"),
          description: data.error ?? t("account.somethingWentWrong"),
          variant: "destructive",
        });
      } else {
        toast({ title: t("account.passwordUpdated") });
        resetPasswordState();
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: t("account.failedToUpdate"),
          description: data.error ?? t("account.somethingWentWrong"),
          variant: "destructive",
        });
      } else {
        supabase.auth.signOut().catch(() => {});
        window.location.href = "/login";
        return;
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed || !user) return;

    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, email: user.email!, name: trimmed },
          { onConflict: "id" },
        );

      if (error) {
        toast({
          title: t("account.failedToUpdate"),
          description: error.message,
          variant: "destructive",
        });
      } else {
        await refreshProfile();
        toast({ title: t("account.displayNameUpdated") });
      }
    } finally {
      setSavingName(false);
    }
  };

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-5xl flex-col gap-6">
      <SkilioHero
        title="Account controls"
        description="Manage the identity used for job postings, applicant review, and workspace access."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Email */}
        <section>
          <SkilioPanel className="p-5">
              <h2 className="text-base font-semibold text-[#10233f]">{t("account.email")}</h2>
              <p className="mt-3 rounded-2xl border border-[#dfe8db] bg-[#fbfdf8] p-3 text-sm text-[#5e6b7a]">
                {t("account.emailValue", { email: user?.email ?? "—" })}
              </p>
          </SkilioPanel>
        </section>

        {/* Display Name */}
        <section>
          <SkilioPanel className="space-y-3 p-5">
              <h2 className="text-base font-semibold text-[#10233f]">
                {t("account.displayName")}
              </h2>
              <p className="text-sm text-[#5e6b7a]">
                {t("account.displayNameCurrent", {
                  name: profile?.name ?? "—",
                })}
              </p>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("account.displayNamePlaceholder")}
                className="w-full border-[#dfe8db] bg-[#fbfdf8]"
              />
              <Button
                size="sm"
                className="rounded-xl bg-[#2f7d4f] text-white hover:bg-[#256a42]"
                onClick={handleSaveName}
                disabled={savingName}
              >
                {savingName ? t("account.saving") : t("account.save")}
              </Button>
          </SkilioPanel>
        </section>

        {/* Password */}
        <section className="lg:col-span-2">
          <SkilioPanel className="space-y-3 p-5">
              <h2 className="text-base font-semibold text-[#10233f]">
                {t("account.password")}
              </h2>
              {passwordStep === "idle" && (
                <>
                  <p className="text-sm text-[#5e6b7a]">{t("account.passwordDescription")}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-[#b8dfa9] text-[#24533b] hover:bg-[#e6f6df]"
                    onClick={() => setPasswordStep("form")}
                  >
                    {t("account.changePassword")}
                  </Button>
                </>
              )}

              {passwordStep === "form" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("auth.newPassword")}
                    </label>
                    <Input
                      type="password"
                      placeholder={t("auth.passwordHint")}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      className="border-[#dfe8db] bg-[#fbfdf8]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("account.confirmPassword")}
                    </label>
                    <Input
                      type="password"
                      placeholder={t("auth.repeatPassword")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      className="border-[#dfe8db] bg-[#fbfdf8]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={passwordLoading}
                      onClick={handleChangePassword}
                    >
                      {passwordLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("account.updatePassword")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={passwordLoading}
                      onClick={resetPasswordState}
                    >
                      {t("account.cancel")}
                    </Button>
                  </div>
                </>
              )}
          </SkilioPanel>
        </section>

        {/* Danger Zone */}
        <section className="lg:col-span-2">
          <SkilioPanel className="space-y-3 border-[#f2c7c7] bg-[#fffafa] p-5">
              <h2 className="text-base font-semibold text-[#b42318]">
                {t("account.deleteStep")}
              </h2>
              {deleteStep === "idle" && (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#10233f]">
                      {t("account.deleteStep")}
                    </p>
                    <p className="text-xs text-[#6f4b4b]">
                      {t("account.deleteDescription")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="shrink-0"
                    onClick={() => setDeleteStep("confirm")}
                  >
                    {t("account.deleteAccount")}
                  </Button>
                </div>
              )}

              {deleteStep === "confirm" && (
                <>
                  <div className="rounded-md bg-destructive/10 p-3">
                    <p className="text-sm font-medium text-destructive">
                      {t("account.deleteConfirmTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("account.deleteConfirmBody")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteLoading}
                      onClick={handleDeleteAccount}
                    >
                      {deleteLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("account.deleteAccount")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deleteLoading}
                      onClick={() => setDeleteStep("idle")}
                    >
                      {t("account.cancel")}
                    </Button>
                  </div>
                </>
              )}
          </SkilioPanel>
        </section>
      </div>
    </SkilioMotionRoot>
  );
}
