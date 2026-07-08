"use client";

import { useAppLocale } from "@/components/app-locale-provider";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
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
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden rounded-[var(--skilio-radius-lg)] border-[var(--skilio-border)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-2)]">
      <CardHeader className="text-center">
        <Image
          src="/logos/skilio-leaf-square.png"
          alt="Skilio"
          width={56}
          height={56}
          className="mx-auto mb-3 h-14 w-14 rounded-[var(--skilio-radius-md)] shadow-[var(--skilio-shadow-1)]"
          priority
        />
        <CardTitle className="font-heading text-2xl">Employer sign in</CardTitle>
        <CardDescription>Use your employer account to manage job openings.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button className="w-full rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]" type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in with password
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-medium text-[var(--skilio-brand)] hover:underline">
            {t("auth.signUp")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
