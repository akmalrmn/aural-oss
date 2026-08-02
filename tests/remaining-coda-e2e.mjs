import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const employerEmail = "akmalramadannn@gmail.com";
const portfolioDatabaseUrl = process.env.PORTFOLIO_DATABASE_URL;
const portfolioInternalUrl =
  process.env.PORTFOLIO_INTERNAL_URL ?? "http://127.0.0.1:3200";
const serviceSecret = process.env.SKILIO_SSO_SECRET;
const outputDir = "artifacts/playwright/remaining-coda";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

assert.ok(portfolioDatabaseUrl, "PORTFOLIO_DATABASE_URL is configured");
assert.ok(serviceSecret, "SKILIO_SSO_SECRET is configured");
await mkdir(outputDir, { recursive: true });

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const jobTitle = `Catalogue Product Designer ${suffix}`;
const candidateEmail = `application-profile-${suffix}@example.com`;
let jobId = null;
let applicationId = null;

const browser = await chromium.launch({ headless: true });
const employerContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const candidateContext = await browser.newContext({
  viewport: { width: 1365, height: 900 },
});
const employerPage = await employerContext.newPage();
const candidatePage = await candidateContext.newPage();
const browserErrors = [];

for (const page of [employerPage, candidatePage]) {
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(90_000);
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
}

const portfolioDb = new PgClient({ connectionString: portfolioDatabaseUrl });
await portfolioDb.connect();

try {
  const confirmation = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: employerEmail,
    options: {
      redirectTo: `${baseUrl}/auth/confirm?next=/jobs/new`,
    },
  });
  assert.equal(confirmation.error, null);
  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  assert.ok(tokenHash);

  await employerPage.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/jobs/new`,
    { waitUntil: "domcontentloaded" },
  );
  await employerPage.waitForURL("**/jobs/new");
  await employerPage.waitForLoadState("networkidle");

  await employerPage.getByLabel("Job title").fill(jobTitle);
  await employerPage.getByLabel("Department").fill("Product");
  await employerPage.getByLabel("Location").fill("Kuala Lumpur / Hybrid");
  await employerPage.getByLabel("Job description").fill(
    [
      "Lead product discovery and translate customer research into clear product decisions.",
      "Build prototypes in Figma, maintain an accessible design system, and collaborate with product and engineering.",
      "Use customer feedback and product metrics to communicate product strategy to stakeholders.",
    ].join("\n\n"),
  );
  const continueButton = employerPage.getByRole("button", {
    name: "Continue",
  });
  await employerPage.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find(
      (candidate) => candidate.textContent?.trim() === "Continue",
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await continueButton.click();
  await employerPage
    .getByText("Suggested from the job description", { exact: true })
    .waitFor();
  await employerPage
    .getByRole("button", { name: "Product Metrics", exact: true })
    .click();

  await employerPage
    .locator('button:has-text("Search the skill catalogue")')
    .click();
  await employerPage
    .getByPlaceholder("Type at least 2 characters...")
    .fill("User Research");
  await employerPage
    .getByRole("option", { name: /User Research Specialized Skill/ })
    .first()
    .click();
  await employerPage.getByText("2 skills", { exact: true }).waitFor();

  await employerPage.screenshot({
    path: `${outputDir}/01-catalogue-skills-desktop.png`,
    fullPage: true,
  });
  await employerPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await employerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "Skill catalogue step does not overflow mobile",
  );
  await employerPage.screenshot({
    path: `${outputDir}/02-catalogue-skills-mobile.png`,
    fullPage: true,
  });
  await employerPage.setViewportSize({ width: 1440, height: 1000 });

  await employerPage.getByRole("button", { name: "Continue" }).click();
  await employerPage.getByRole("button", { name: "Continue" }).click();
  await employerPage.getByRole("button", { name: "Publish" }).click();
  await employerPage.waitForURL(/\/jobs\/[0-9a-f-]+$/);
  jobId = employerPage.url().split("/").pop();
  await employerPage
    .getByRole("heading", { name: "Job post status" })
    .waitFor();

  const { data: storedSkills, error: storedSkillsError } = await supabase
    .from("job_skills")
    .select("name,lightcastId,skillSource")
    .eq("jobId", jobId)
    .order("displayOrder");
  assert.equal(storedSkillsError, null);
  assert.equal(storedSkills.length, 2);
  assert.ok(storedSkills.every((skill) => skill.lightcastId));
  assert.ok(storedSkills.every((skill) => skill.skillSource === "LIGHTCAST"));

  const { data: job, error: jobError } = await supabase
    .from("job_postings")
    .select("publicSlug")
    .eq("id", jobId)
    .single();
  assert.equal(jobError, null);

  await candidatePage.goto(`${baseUrl}/apply/${job.publicSlug}`);
  await candidatePage.waitForLoadState("networkidle");
  await candidatePage
    .getByRole("button", { name: "Start application" })
    .click();
  await candidatePage
    .getByRole("button", { name: /Continue manually/ })
    .click();
  await candidatePage
    .getByRole("button", { name: "Continue to profile" })
    .click();
  await candidatePage.getByLabel("Full name").fill("Provisioned Candidate");
  await candidatePage.getByLabel("Email").fill(candidateEmail);
  await candidatePage.getByLabel("Phone", { exact: true }).fill("123456789");
  await candidatePage
    .getByRole("combobox", { name: "Country", exact: true })
    .click();
  await candidatePage.getByRole("option", { name: "Malaysia" }).click();
  const accountConsent = candidatePage.getByRole("checkbox", {
    name: /Create my Skilio profile from this application/,
  });
  assert.equal(await accountConsent.isChecked(), false);
  await accountConsent.check();
  await candidatePage.screenshot({
    path: `${outputDir}/03-account-consent.png`,
    fullPage: true,
  });
  await candidatePage
    .getByRole("button", { name: "Continue to Drawmetrics" })
    .click();
  await candidatePage.getByTestId("drawmetrics-assessment").waitFor();

  for (let index = 0; index < 10; index += 1) {
    const canvas = candidatePage.getByTestId("drawing-assessment-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    assert.ok(box);
    await candidatePage.mouse.move(
      box.x + box.width * 0.25,
      box.y + box.height * 0.62,
    );
    await candidatePage.mouse.down();
    await candidatePage.mouse.move(
      box.x + box.width * 0.5,
      box.y + box.height * 0.32,
      { steps: 4 },
    );
    await candidatePage.mouse.move(
      box.x + box.width * 0.75,
      box.y + box.height * 0.62,
      { steps: 4 },
    );
    await candidatePage.mouse.up();
    await candidatePage
      .getByTestId("drawing-phrase")
      .fill(`Provisioning drawing ${index + 1}`);
    await candidatePage.getByTestId("save-drawing-response").click();
  }

  await candidatePage
    .getByRole("button", { name: "Continue to skills" })
    .click();
  await candidatePage
    .getByText(
      "Select only the role skills you can demonstrate to the hiring team.",
      { exact: true },
    )
    .waitFor();
  await candidatePage
    .getByRole("button", { name: /User Research/ })
    .first()
    .click();
  await candidatePage
    .getByRole("button", { name: "Continue to portfolio" })
    .click();
  await candidatePage
    .getByRole("button", { name: "Continue to pre-screening" })
    .click();
  await candidatePage
    .getByRole("button", { name: "Review application" })
    .click();
  await candidatePage
    .getByRole("button", { name: "Submit application" })
    .click();
  await candidatePage
    .getByRole("heading", { name: "Application submitted" })
    .waitFor();
  await candidatePage
    .getByText("Your Skilio profile is ready to activate", { exact: true })
    .waitFor();
  await candidatePage.screenshot({
    path: `${outputDir}/04-account-created.png`,
    fullPage: true,
  });

  const { data: application, error: applicationError } = await supabase
    .from("job_applications")
    .select("id")
    .eq("jobId", jobId)
    .eq("email", candidateEmail)
    .single();
  assert.equal(applicationError, null);
  applicationId = application.id;

  const { data: provisioning, error: provisioningError } = await supabase
    .from("job_application_provisioning")
    .select("status,portfolioUserId,username,attempts")
    .eq("applicationId", applicationId)
    .single();
  assert.equal(provisioningError, null);
  assert.equal(provisioning.status, "COMPLETED");
  assert.equal(provisioning.attempts, 1);
  assert.ok(provisioning.portfolioUserId);

  const portfolioUser = await portfolioDb.query(
    `SELECT u.id, u.username, s."lightcastId"
       FROM users u
       LEFT JOIN skills s ON s."userId" = u.id
      WHERE u.email = $1`,
    [candidateEmail],
  );
  assert.ok(portfolioUser.rows.length >= 1);
  assert.equal(portfolioUser.rows[0].lightcastId, "ESCA20E43F8CF426D784");

  const serviceToken = await new SignJWT({ scope: "accounts:provision" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("assessment.skilio.co")
    .setAudience("portfolio.skilio.co")
    .setSubject("aural-job-portal")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(serviceSecret));
  const existingAccountResponse = await fetch(
    `${portfolioInternalUrl}/api/internal/assessment/accounts/provision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        applicationId,
        name: "Provisioned Candidate",
        email: candidateEmail,
        country: "Malaysia",
        phone: "+60123456789",
        skills: [
          {
            name: "User Research",
            lightcastId: "ESCA20E43F8CF426D784",
            lightcastType: "SPECIALIZED",
          },
        ],
      }),
    },
  );
  assert.equal(existingAccountResponse.status, 200);
  const existingAccount = await existingAccountResponse.json();
  assert.equal(existingAccount.status, "EXISTING_ACCOUNT");
  assert.equal(existingAccount.portfolioUserId, provisioning.portfolioUserId);

  const actionableErrors = browserErrors.filter(
    (message) =>
      !message.includes("favicon") &&
      !message.includes("ResizeObserver loop") &&
      !message.includes("Failed to load resource"),
  );
  assert.deepEqual(
    actionableErrors,
    [],
    `Browser console errors: ${actionableErrors.join("\n")}`,
  );

  console.log(
    JSON.stringify({
      ok: true,
      jobId,
      applicationId,
      screenshots: outputDir,
    }),
  );
} finally {
  if (jobId) {
    await supabase.from("job_postings").delete().eq("id", jobId);
  }
  await portfolioDb.query("DELETE FROM users WHERE email = $1", [
    candidateEmail,
  ]);
  await portfolioDb.end();
  await employerContext.close().catch(() => {});
  await candidateContext.close().catch(() => {});
  await browser.close();
}
