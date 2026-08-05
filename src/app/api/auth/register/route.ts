import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claimAuthEmailSend } from "@/lib/auth-email-rate-limit";
import { sendAuthVerificationEmail } from "@/lib/auth-verification-email";
import { buildEmployerSignupMetadata } from "@/lib/employer-onboarding";
import { supabaseAdmin } from "@/lib/supabase/admin";

const registrationSchema = z.object({
  companyName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid name, company, work email, and password." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const rateLimit = claimAuthEmailSend(`register:${email}`);
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: `Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another code.`,
      },
      { status: 429 },
    );
  }

  const metadata = buildEmployerSignupMetadata(parsed.data);
  let verificationType: "signup" | "magiclink" = "signup";
  let link = await supabaseAdmin.auth.admin.generateLink({
    type: "signup",
    email,
    password: parsed.data.password,
    options: { data: metadata },
  });

  if (link.error) {
    verificationType = "magiclink";
    link = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { data: metadata },
    });
  }

  const code = link.data.properties?.email_otp;
  const userId = link.data.user?.id;
  if (link.error || !code || !userId) {
    console.error("Assessment registration link generation failed:", link.error);
    return NextResponse.json(
      { error: "Unable to prepare email verification. Try signing in if this account already exists." },
      { status: 400 },
    );
  }

  try {
    await sendAuthVerificationEmail({ to: email, code });
  } catch (error) {
    console.error("Assessment verification email failed:", error);
    if (verificationType === "signup") {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return NextResponse.json(
      { error: "We could not send the verification code. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    email,
    verificationType,
    codeLength: code.length,
  });
}
