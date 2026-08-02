import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const employerEmail = process.env.E2E_EMPLOYER_EMAIL;
const outputDir = "artifacts/playwright/job-authoring";

assert.ok(employerEmail, "E2E_EMPLOYER_EMAIL is configured");
assert.ok(process.env.SUPABASE_URL, "SUPABASE_URL is configured");
assert.ok(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  "SUPABASE_SERVICE_ROLE_KEY is configured",
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(90_000);
page.setDefaultNavigationTimeout(90_000);
const browserErrors = [];

page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

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

  await page.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/jobs/new`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForURL("**/jobs/new");
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Draft with AI",
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });

  await page.screenshot({
    path: `${outputDir}/01-role-authoring-tools.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Draft with AI" }).click();
  const generateDialog = page.getByRole("dialog");
  await generateDialog.getByLabel("Job title").fill("Product Designer");
  await generateDialog.getByLabel("Department").fill("Product");
  await generateDialog
    .getByLabel("Location")
    .fill("Kuala Lumpur / Hybrid");
  await generateDialog.getByLabel("Role outcomes and context").fill(
    [
      "Lead customer discovery for a B2B education product.",
      "Turn research into tested Figma prototypes and measurable product decisions.",
      "Work with product and engineering, maintain an accessible design system, and communicate outcomes with product metrics.",
    ].join(" "),
  );
  await generateDialog
    .getByRole("button", { name: "Create draft" })
    .click();
  await page
    .getByRole("heading", { name: "Review the proposed changes" })
    .waitFor();

  assert.equal(
    await page.locator("#title").inputValue(),
    "",
    "AI output does not change the form before review",
  );
  await page.screenshot({
    path: `${outputDir}/02-ai-draft-review.png`,
  });

  const reviewDialog = page.getByRole("dialog");
  const screeningToggle = reviewDialog.getByLabel(
    "Apply Pre-screening questions",
  );
  if ((await screeningToggle.count()) > 0) {
    const screeningReview = await screeningToggle
      .locator("xpath=ancestor::label")
      .innerText();
    assert.match(
      screeningReview,
      /Required|Optional/,
      "generated screening questions expose their review details",
    );
  }
  await reviewDialog.getByRole("button", { name: "Clear" }).click();
  await reviewDialog.getByLabel("Apply Job title").click();
  await reviewDialog.getByLabel("Apply Job description").click();
  await reviewDialog
    .getByRole("button", { name: "Apply 2 fields" })
    .click();
  await page
    .getByRole("heading", { name: "Review the proposed changes" })
    .waitFor({ state: "hidden" });

  assert.ok((await page.locator("#title").inputValue()).length >= 2);
  assert.ok((await page.locator("#description").inputValue()).length >= 80);
  assert.equal(
    await page.locator("#department").inputValue(),
    "",
    "Unselected generated fields preserve the current form",
  );

  const forbiddenImportStatus = await page.evaluate(async () => {
    const formData = new FormData();
    formData.append("projectId", "project-without-employer-access");
    formData.append(
      "file",
      new File(
        [
          "Product Designer role with customer research, prototyping, accessibility, and cross-functional delivery responsibilities.",
        ],
        "role.txt",
        { type: "text/plain" },
      ),
    );
    return (
      await fetch("/api/jobs/draft/import", {
        method: "POST",
        body: formData,
      })
    ).status;
  });
  assert.equal(
    forbiddenImportStatus,
    403,
    "JD import rejects projects outside the employer workspace",
  );

  await page.getByTestId("job-document-input").setInputFiles({
    name: "renamed.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("This is not a PDF."),
  });
  await page
    .getByText("The file content does not match its extension.", {
      exact: false,
    })
    .waitFor();

  const importedJd = [
    "Customer Success Operations Specialist",
    "",
    "Department: Customer Success",
    "Location: Remote, Malaysia",
    "Employment type: Full-time",
    "Seniority: Mid-level",
    "",
    "About the role",
    "Own customer onboarding operations for a B2B learning platform and improve the systems used by the customer success team.",
    "",
    "Responsibilities",
    "- Build and maintain onboarding workflows.",
    "- Analyze customer feedback and service metrics.",
    "- Coordinate with product, sales, and support teams.",
    "- Document repeatable processes and improve response quality.",
    "",
    "Requirements",
    "- Experience with customer success operations.",
    "- Strong spreadsheet analysis and written communication.",
    "- Familiarity with CRM workflows and process documentation.",
  ].join("\n");

  await page.getByTestId("job-document-input").setInputFiles({
    name: "customer-success-role.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(importedJd),
  });
  await page
    .getByRole("heading", { name: "Review the proposed changes" })
    .waitFor();
  await page
    .getByText("Imported from customer-success-role.txt", { exact: true })
    .waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      window.innerWidth === 390 &&
      window.matchMedia("(max-width: 639px)").matches,
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForTimeout(250);
  const mobileReview = page.getByRole("dialog");
  const reviewBounds = await mobileReview.boundingBox();
  assert.ok(reviewBounds, "review dialog has visible bounds");
  await page.screenshot({
    path: `${outputDir}/03-import-review-mobile.png`,
  });
  assert.ok(
    reviewBounds.x >= -1,
    `review dialog starts inside the viewport: ${JSON.stringify(reviewBounds)}`,
  );
  assert.ok(
    reviewBounds.x + reviewBounds.width <= 391,
    `review dialog fits inside the mobile viewport: ${JSON.stringify(reviewBounds)}`,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "JD review does not overflow mobile",
  );
  const applyButton = mobileReview.getByRole("button", {
    name: /^Apply \d+ fields?$/,
  });
  await applyButton.click();
  await page
    .getByRole("heading", { name: "Review the proposed changes" })
    .waitFor({ state: "hidden" });
  assert.match(await page.locator("#title").inputValue(), /Customer Success/i);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByText("Suggested from the job description", { exact: true })
    .waitFor();
  await page.screenshot({
    path: `${outputDir}/04-lightcast-handoff.png`,
    fullPage: true,
  });

  const relevantErrors = browserErrors.filter(
    (message) =>
      !message.includes("favicon") &&
      !/Failed to load resource: the server responded with a status of (400|403)/.test(
        message,
      ),
  );
  assert.deepEqual(relevantErrors, []);

  console.log(
    JSON.stringify({
      ok: true,
      screenshots: outputDir,
      generatedTitle: await page.locator("h1").textContent().catch(() => null),
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      url: page.url(),
      browserErrors,
      body: (await page.locator("body").innerText().catch(() => "")).slice(
        0,
        2_000,
      ),
    }),
  );
  throw error;
} finally {
  await browser.close();
}
