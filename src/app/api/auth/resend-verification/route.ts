import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claimAuthEmailSend } from "@/lib/auth-email-rate-limit";
import { sendAuthVerificationEmail } from "@/lib/auth-verification-email";
import { supabaseAdmin } from "@/lib/supabase/admin";

const resendSchema = z.object({
  email: z.string().trim().email().max(254),
});

export async function POST(request: NextRequest) {
  const parsed = resendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const rateLimit = claimAuthEmailSend(`resend:${email}`);
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: `Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another code.`,
      },
      { status: 429 },
    );
  }

  const link = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const code = link.data.properties?.email_otp;

  if (link.error || !code) {
    console.error("Assessment verification resend failed:", link.error);
    return NextResponse.json(
      { error: "Unable to prepare a new verification code." },
      { status: 400 },
    );
  }

  try {
    await sendAuthVerificationEmail({ to: email, code });
  } catch (error) {
    console.error("Assessment verification resend email failed:", error);
    return NextResponse.json(
      { error: "We could not send the verification code. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    verificationType: "magiclink",
    codeLength: code.length,
  });
}
