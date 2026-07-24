import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const employerEmail = "akmalramadannn@gmail.com";
const outputDir = "artifacts/playwright/coda-feedback";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const employerContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const employerPage = await employerContext.newPage();
employerPage.setDefaultTimeout(60_000);
employerPage.setDefaultNavigationTimeout(90_000);
let createdJobId = null;

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

  await employerPage.screenshot({
    path: `${outputDir}/01-create-role.png`,
    fullPage: true,
  });

  const uniqueTitle = `Feedback Product Designer ${Date.now()}`;
  await employerPage.getByLabel("Job title").fill(uniqueTitle);
  await employerPage.getByLabel("Department").fill("Product Design");
  await employerPage.getByLabel("Location").fill("Kuala Lumpur / Hybrid");
  await employerPage.getByLabel("Job description").fill(
    [
      "Lead product discovery and translate customer research into clear product decisions.",
      "",
      "You will own Figma prototypes, collaborate with product and engineering, and use metrics to improve the customer experience.",
      "",
      "Success in this role means a coherent design system, measurable outcomes, and clear stakeholder communication.",
    ].join("\n"),
  );
  await employerPage.getByRole("button", { name: "Continue" }).click();

  await employerPage.getByRole("button", { name: /Figma/ }).click();
  await employerPage.screenshot({
    path: `${outputDir}/02-create-skills.png`,
    fullPage: true,
  });
  await employerPage.getByRole("button", { name: "Continue" }).click();

  await employerPage.getByRole("button", { name: "Add question" }).click();
  await employerPage
    .getByRole("textbox", { name: "Question 1", exact: true })
    .fill("When can you start?");
  await employerPage.getByText("Required to submit").click();

  await employerPage.getByRole("button", { name: "Add question" }).click();
  await employerPage
    .getByRole("textbox", { name: "Question 2", exact: true })
    .fill("What is your current notice period?");
  await employerPage
    .locator('[aria-label="Answer type"]')
    .nth(1)
    .click()
    .catch(async () => {
      await employerPage.getByRole("combobox").nth(1).click();
    });
  await employerPage.getByRole("option", { name: "Multiple choice" }).click();
  await employerPage
    .getByLabel("Choices, separated by commas")
    .fill("Immediate, 2 weeks, 1 month");

  await employerPage.screenshot({
    path: `${outputDir}/03-create-screening.png`,
    fullPage: true,
  });
  await employerPage.getByRole("button", { name: "Continue" }).click();
  await employerPage.screenshot({
    path: `${outputDir}/04-create-preview.png`,
    fullPage: true,
  });
  await employerPage.getByRole("button", { name: "Publish" }).click();
  await employerPage.waitForURL(/\/jobs\/[0-9a-f-]+$/);
  createdJobId = employerPage.url().split("/").pop();
  await employerPage.waitForLoadState("networkidle");
  await employerPage
    .getByText("Job post status")
    .waitFor({ state: "visible" });

  await employerPage.screenshot({
    path: `${outputDir}/05-job-dashboard.png`,
    fullPage: true,
  });
  assert.ok(
    await employerPage.getByText("Pre-screening", { exact: true }).isVisible(),
    "Pre-screening summary is visible",
  );

  await employerPage.setViewportSize({ width: 390, height: 844 });
  await employerPage.screenshot({
    path: `${outputDir}/06-job-dashboard-mobile.png`,
    fullPage: true,
  });
  await employerPage.setViewportSize({ width: 1440, height: 1000 });

  const applyHref = await employerPage
    .getByRole("link", { name: "View apply page" })
    .getAttribute("href");
  assert.ok(applyHref);
  const applyPath = new URL(applyHref).pathname;

  const candidateContext = await browser.newContext({
    viewport: { width: 1280, height: 960 },
  });
  const candidatePage = await candidateContext.newPage();
  await candidatePage.goto(`${baseUrl}${applyPath}`);
  await candidatePage.waitForLoadState("networkidle");
  await candidatePage.screenshot({
    path: `${outputDir}/07-application-access.png`,
    fullPage: true,
  });

  await candidatePage
    .getByRole("button", { name: /Continue manually/ })
    .click();
  await candidatePage
    .getByRole("button", { name: "Continue to profile" })
    .click();
  await candidatePage.getByLabel("Full name").fill("Coda Feedback Candidate");
  await candidatePage
    .getByLabel("Email")
    .fill(`coda-feedback-${Date.now()}@example.com`);
  await candidatePage
    .getByRole("textbox", { name: "Phone", exact: true })
    .fill("123456789");
  await candidatePage
    .getByRole("combobox", { name: "Country", exact: true })
    .click();
  await candidatePage.getByRole("option", { name: "Indonesia" }).click();
  await candidatePage.screenshot({
    path: `${outputDir}/08-application-profile.png`,
    fullPage: true,
  });

  await candidatePage
    .getByRole("button", { name: "Continue to Drawmetrics" })
    .click();
  await candidatePage.screenshot({
    path: `${outputDir}/09-application-drawmetrics.png`,
    fullPage: true,
  });
  await candidatePage
    .getByRole("button", { name: "Continue to skills" })
    .click();

  const roleSkillButtons = candidatePage.locator(
    'button:has-text("Must-have")',
  );
  assert.equal(
    await roleSkillButtons
      .filter({ has: candidatePage.locator("svg.lucide-check") })
      .count(),
    0,
    "Manual candidates do not receive preselected role skills",
  );
  await roleSkillButtons.first().click();
  await candidatePage.getByPlaceholder("Add another skill").fill("Facilitation");
  await candidatePage.getByRole("button", { name: "Add", exact: true }).click();
  await candidatePage.screenshot({
    path: `${outputDir}/10-application-skills.png`,
    fullPage: true,
  });

  await candidatePage
    .getByRole("button", { name: "Continue to portfolio" })
    .click();
  await candidatePage
    .getByLabel(/Tell us why you are applying/)
    .fill("I want to bring evidence-led product design to this team.");
  await candidatePage
    .getByRole("button", { name: "Continue to pre-screening" })
    .click();
  await candidatePage
    .getByLabel(/When can you start/)
    .fill("I can start in two weeks.");
  await candidatePage
    .getByLabel(/What is your current notice period/)
    .click();
  await candidatePage.getByRole("option", { name: "2 weeks" }).click();
  await candidatePage.screenshot({
    path: `${outputDir}/11-application-screening.png`,
    fullPage: true,
  });
  await candidatePage
    .getByRole("button", { name: "Review application" })
    .click();
  await candidatePage.screenshot({
    path: `${outputDir}/12-application-review.png`,
    fullPage: true,
  });
  const formSubmitted = await candidatePage.evaluate(() => {
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return false;
    form.requestSubmit();
    return true;
  });
  assert.ok(formSubmitted, "Application form is present on the review step");
  await candidatePage.getByText("Application submitted").waitFor();
  await candidateContext.close();

  await employerPage.goto(`${baseUrl}/jobs/${createdJobId}`);
  await employerPage.waitForLoadState("networkidle");
  await employerPage
    .getByRole("link", { name: "Coda Feedback Candidate" })
    .waitFor({ state: "visible" });
  await employerPage
    .getByRole("link", { name: "Coda Feedback Candidate" })
    .click();
  await employerPage.waitForURL("**/applicants/**");
  await employerPage.waitForLoadState("networkidle");

  await employerPage
    .getByText("Pre-screening questions", { exact: true })
    .waitFor({ state: "visible" });
  await employerPage
    .getByRole("heading", { name: "Drawmetrics results" })
    .waitFor({ state: "visible" });
  await employerPage.screenshot({
    path: `${outputDir}/13-applicant-review.png`,
    fullPage: true,
  });

  await employerPage
    .getByRole("button", { name: "Mark reviewed" })
    .click();
  await employerPage
    .getByRole("button", { name: "Accept" })
    .click();
  await employerPage.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some(
        (button) =>
          button.textContent?.trim() === "Accept" &&
          button.className.includes("bg-[var(--skilio-brand)]"),
      ),
    undefined,
    { timeout: 15_000 },
  );
  await employerPage.screenshot({
    path: `${outputDir}/14-applicant-accepted.png`,
    fullPage: true,
  });

  console.log(
    JSON.stringify({
      ok: true,
      screenshots: outputDir,
      jobId: createdJobId,
    }),
  );
} finally {
  if (createdJobId) {
    await supabase.from("job_postings").delete().eq("id", createdJobId);
  }
  if (browser.isConnected()) {
    await employerContext.close().catch(() => {});
    await browser.close();
  }
}
