import { jwtVerify } from "jose";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SkilioSsoProfile = {
  portfolioUserId: string;
  email: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  profile?: Record<string, unknown>;
  skills?: string[];
};

function textEncoderSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export function getPortfolioBaseUrl() {
  return (process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? "https://portfolio.skilio.co").replace(
    /\/$/,
    "",
  );
}

export function getAssessmentBaseUrl(origin: string) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? origin).replace(/\/$/, "");
}

export async function verifySkilioSsoToken(token: string): Promise<SkilioSsoProfile> {
  const secret = process.env.SKILIO_SSO_SECRET;
  if (!secret) {
    throw new Error("SKILIO_SSO_SECRET is not configured.");
  }

  const { payload } = await jwtVerify(token, textEncoderSecret(secret), {
    issuer: process.env.SKILIO_SSO_ISSUER ?? "portfolio.skilio.co",
    audience: process.env.SKILIO_SSO_AUDIENCE ?? "assessment.skilio.co",
  });

  const email = typeof payload.email === "string" ? payload.email : undefined;
  const portfolioUserId =
    typeof payload.sub === "string"
      ? payload.sub
      : typeof payload.portfolioUserId === "string"
        ? payload.portfolioUserId
        : undefined;

  if (!email || !portfolioUserId) {
    throw new Error("Skilio SSO token is missing an email or subject.");
  }

  return {
    portfolioUserId,
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    username: typeof payload.username === "string" ? payload.username : undefined,
    avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : undefined,
    profile:
      payload.profile && typeof payload.profile === "object"
        ? (payload.profile as Record<string, unknown>)
        : undefined,
    skills: Array.isArray(payload.skills)
      ? payload.skills.filter((skill): skill is string => typeof skill === "string")
      : undefined,
  };
}

export async function fetchPortfolioProfile(token: string) {
  const endpoint =
    process.env.SKILIO_PORTFOLIO_PROFILE_URL ?? `${getPortfolioBaseUrl()}/api/sso/profile`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as Partial<SkilioSsoProfile>;
  } catch {
    return null;
  }
}

export async function upsertSkilioIdentityLink(
  userId: string,
  profile: SkilioSsoProfile,
) {
  await supabaseAdmin.from("skilio_identity_links").upsert(
    {
      userId,
      portfolioUserId: profile.portfolioUserId,
      email: profile.email,
      username: profile.username,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      profileSnapshot: profile.profile ?? {},
      skillsSnapshot: profile.skills ?? [],
      lastSyncedAt: new Date().toISOString(),
    },
    { onConflict: "portfolioUserId" },
  );
}
