import { SignJWT } from "jose";
import { getPortfolioBaseUrl } from "@/lib/skilio-sso";

const ASSESSMENT_ISSUER = "assessment.skilio.co";
const PORTFOLIO_AUDIENCE = "portfolio.skilio.co";

export type PortfolioSkill = {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  apiVersion: string;
  confidence?: number | null;
};

export type PortfolioProvisioningSkill = {
  name: string;
  lightcastId?: string | null;
  lightcastType?: "SPECIALIZED" | "COMMON" | "CERTIFICATION" | null;
  lightcastDescription?: string | null;
  lightcastApiVersion?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
};

export type PortfolioProvisioningResult = {
  status: "CREATED" | "EXISTING_ACCOUNT";
  portfolioUserId: string;
  username: string;
  activationEmailSent?: boolean;
  nextUrl: string;
};

function serviceSecret() {
  const secret = process.env.SKILIO_SSO_SECRET;
  if (!secret) {
    throw new Error("SKILIO_SSO_SECRET is not configured.");
  }
  return new TextEncoder().encode(secret);
}

function portfolioInternalBaseUrl() {
  return (
    process.env.SKILIO_PORTFOLIO_INTERNAL_URL ?? getPortfolioBaseUrl()
  ).replace(/\/$/, "");
}

async function serviceToken(scope: string) {
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ASSESSMENT_ISSUER)
    .setAudience(PORTFOLIO_AUDIENCE)
    .setSubject("aural-job-portal")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(serviceSecret());
}

async function portfolioRequest<T>(
  path: string,
  scope: string,
  init?: RequestInit,
): Promise<T> {
  const token = await serviceToken(scope);
  const response = await fetch(`${portfolioInternalBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error || `Skilio portfolio service returned ${response.status}.`,
    );
  }

  return payload as T;
}

export async function searchPortfolioSkills(query: string, limit = 10) {
  const search = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  const result = await portfolioRequest<{ skills: PortfolioSkill[] }>(
    `/api/internal/assessment/skills/search?${search.toString()}`,
    "skills:read",
  );
  return result.skills;
}

export async function extractPortfolioSkills(text: string, limit = 12) {
  const result = await portfolioRequest<{ skills: PortfolioSkill[] }>(
    "/api/internal/assessment/skills/extract",
    "skills:read",
    {
      method: "POST",
      body: JSON.stringify({ text, limit }),
    },
  );
  return result.skills;
}

export async function provisionPortfolioAccount(input: {
  applicationId: string;
  name: string;
  email: string;
  country?: string | null;
  phone?: string | null;
  skills: PortfolioProvisioningSkill[];
}) {
  return portfolioRequest<PortfolioProvisioningResult>(
    "/api/internal/assessment/accounts/provision",
    "accounts:provision",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
