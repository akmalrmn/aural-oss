import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchPortfolioProfile,
  getAssessmentBaseUrl,
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

    if (link.error || !link.data.properties?.action_link || !link.data.user?.id) {
      throw link.error ?? new Error("Supabase did not return an SSO action link.");
    }

    await upsertSkilioIdentityLink(link.data.user.id, profile);

    return NextResponse.redirect(link.data.properties.action_link);
  } catch (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "skilio_sso_failed");
    if (error instanceof Error) {
      loginUrl.searchParams.set("message", error.message);
    }
    return NextResponse.redirect(loginUrl);
  }
}
