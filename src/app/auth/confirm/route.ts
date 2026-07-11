import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAssessmentBaseUrl } from "@/lib/skilio-sso";
import { createClient } from "@/lib/supabase/server";

function safeRedirectUrl(next: string, baseUrl: string) {
  const fallback = new URL("/jobs", baseUrl);

  try {
    const target = new URL(next, baseUrl);
    if (target.origin !== fallback.origin) return fallback;
    return target;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const baseUrl = getAssessmentBaseUrl(origin);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/jobs";

  if (tokenHash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(safeRedirectUrl(next, baseUrl));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_confirm_failed", baseUrl));
}
