import { NextRequest, NextResponse } from "next/server";
import { getAssessmentBaseUrl, getPortfolioBaseUrl } from "@/lib/skilio-sso";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const next = request.nextUrl.searchParams.get("next") ?? "/jobs";
  const callback = new URL("/auth/skilio/callback", getAssessmentBaseUrl(origin));
  callback.searchParams.set("next", next);

  const authorize = new URL("/api/sso/authorize", getPortfolioBaseUrl());
  authorize.searchParams.set("return_to", callback.toString());
  authorize.searchParams.set("next", next);
  authorize.searchParams.set("audience", process.env.SKILIO_SSO_AUDIENCE ?? "assessment.skilio.co");

  return NextResponse.redirect(authorize);
}
