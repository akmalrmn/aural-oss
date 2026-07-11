import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchPortfolioProfile,
  getAssessmentBaseUrl,
  upsertAssessmentProfile,
  upsertSkilioIdentityLink,
  verifySkilioSsoToken,
  type SkilioSsoProfile,
} from "@/lib/skilio-sso";

function mergeProfile(
  tokenProfile: SkilioSsoProfile,
  fetchedProfile: Partial<SkilioSsoProfile> | null,
): SkilioSsoProfile {
  return {
    ...tokenProfile,
    ...fetchedProfile,
    portfolioUserId: tokenProfile.portfolioUserId,
    email: tokenProfile.email,
    profile: fetchedProfile?.profile ?? tokenProfile.profile,
    skills: fetchedProfile?.skills ?? tokenProfile.skills,
  };
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const token = request.nextUrl.searchParams.get("token");
  const next = request.nextUrl.searchParams.get("next") ?? "/jobs";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=skilio_sso_missing", origin));
  }

  try {
    const tokenProfile = await verifySkilioSsoToken(token);
    const fetchedProfile = await fetchPortfolioProfile(token);
    const profile = mergeProfile(tokenProfile, fetchedProfile);
    const baseUrl = getAssessmentBaseUrl(origin);
    const redirectTo = new URL("/auth/confirm", baseUrl);
    redirectTo.searchParams.set("next", next);

    let link = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: {
        redirectTo: redirectTo.toString(),
        data: {
          name: profile.name,
          avatar: profile.avatarUrl,
          skilioPortfolioUserId: profile.portfolioUserId,
        },
      },
    });

    if (link.error) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email: profile.email,
        email_confirm: true,
        user_metadata: {
          name: profile.name,
          avatar: profile.avatarUrl,
          skilioPortfolioUserId: profile.portfolioUserId,
        },
      });

      if (created.error) throw created.error;

      link = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: profile.email,
        options: {
          redirectTo: redirectTo.toString(),
          data: {
            name: profile.name,
            avatar: profile.avatarUrl,
            skilioPortfolioUserId: profile.portfolioUserId,
          },
        },
      });
    }

    const tokenHash = link.data.properties?.hashed_token;
    const verificationType = link.data.properties?.verification_type ?? "magiclink";

    if (link.error || !tokenHash || !link.data.user?.id) {
      throw link.error ?? new Error("Supabase did not return an SSO action link.");
    }

    await upsertSkilioIdentityLink(link.data.user.id, profile);
    await upsertAssessmentProfile(link.data.user.id, profile);

    redirectTo.searchParams.set("token_hash", tokenHash);
    redirectTo.searchParams.set("type", verificationType);

    return NextResponse.redirect(redirectTo);
  } catch (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "skilio_sso_failed");
    if (error instanceof Error) {
      loginUrl.searchParams.set("message", error.message);
    }
    return NextResponse.redirect(loginUrl);
  }
}
