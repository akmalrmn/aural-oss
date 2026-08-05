import "server-only";

type VerificationEmailArgs = {
  to: string;
  code: string;
};

type TeamInvitationEmailArgs = VerificationEmailArgs & {
  acceptUrl: string;
  companyName: string;
};

type TeamAccessEmailArgs = {
  companyName: string;
  loginUrl: string;
  to: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendAuthVerificationEmail({
  to,
  code,
}: VerificationEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Assessment email delivery is not configured.");
    }

    console.info(`[Assessment verification] Code for ${to}: ${code}`);
    return;
  }

  const escapedCode = escapeHtml(code);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://assessment.skilio.co";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Verify your Skilio Hiring account",
      text: [
        "Verify your Skilio Hiring account",
        "",
        `Your verification code is ${code}.`,
        "This code expires in one hour.",
        "",
        `Open Skilio Hiring: ${appUrl}/register`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5;max-width:520px;margin:0 auto;">
          <h1 style="font-size:22px;margin:0 0 16px;">Verify your Skilio Hiring account</h1>
          <p style="margin:0 0 16px;">Enter this code on the registration screen:</p>
          <p style="font-family:monospace;font-size:30px;font-weight:700;letter-spacing:7px;margin:0 0 16px;color:#b42318;">${escapedCode}</p>
          <p style="margin:0 0 16px;color:#5e6b7a;">This code expires in one hour.</p>
          <p style="margin:0;"><a href="${escapeHtml(`${appUrl}/register`)}" style="color:#b42318;">Open Skilio Hiring</a></p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned HTTP ${response.status}.`);
  }
}

export async function sendTeamInvitationEmail({
  acceptUrl,
  code,
  companyName,
  to,
}: TeamInvitationEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Assessment email delivery is not configured.");
    }

    console.info(`[Team invitation] Code for ${to}: ${code}. Open ${acceptUrl}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Join ${companyName} on Skilio Hiring`,
      text: [
        `You have been invited to join ${companyName} on Skilio Hiring.`,
        "",
        `Your activation code is ${code}.`,
        "This code expires in one hour.",
        "",
        `Register and accept the invitation: ${acceptUrl}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5;max-width:520px;margin:0 auto;">
          <h1 style="font-size:22px;margin:0 0 16px;">Join ${escapeHtml(companyName)}</h1>
          <p style="margin:0 0 16px;">You have been invited to join this company on Skilio Hiring.</p>
          <p style="margin:0 0 8px;color:#5e6b7a;">Your activation code:</p>
          <p style="font-family:monospace;font-size:30px;font-weight:700;letter-spacing:7px;margin:0 0 16px;color:#b42318;">${escapeHtml(code)}</p>
          <p style="margin:0 0 20px;color:#5e6b7a;">This code expires in one hour.</p>
          <a href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:#b42318;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Register and join workspace</a>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned HTTP ${response.status}.`);
  }
}

export async function sendTeamAccessEmail({
  companyName,
  loginUrl,
  to,
}: TeamAccessEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Assessment email delivery is not configured.");
    }

    console.info(`[Team access] ${to} can open ${loginUrl}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `You now have access to ${companyName} on Skilio Hiring`,
      text: [
        `You have been added to ${companyName} on Skilio Hiring.`,
        "",
        `Sign in with your existing assessment account: ${loginUrl}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5;max-width:520px;margin:0 auto;">
          <h1 style="font-size:22px;margin:0 0 16px;">You now have access to ${escapeHtml(companyName)}</h1>
          <p style="margin:0 0 20px;">Sign in with your existing Skilio Hiring account to open the company workspace.</p>
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#b42318;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Open Skilio Hiring</a>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned HTTP ${response.status}.`);
  }
}
