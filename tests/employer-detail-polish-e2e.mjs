import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const outputDir = "artifacts/playwright/employer-detail-polish";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

await mkdir(outputDir, { recursive: true });

const { data: jobs, error: jobsError } = await supabase
  .from("job_postings")
  .select("id,title,publicSlug,status,job_applications(id)")
  .order("createdAt", { ascending: false })
  .limit(50);
assert.equal(jobsError, null);

const job = jobs.find(
  (item) =>
    item.status === "ACTIVE" &&
    item.publicSlug &&
    item.job_applications.length > 0,
);
assert.ok(job, "A job with at least one applicant exists");
const applicationId = job.job_applications[0].id;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const browserErrors = [];

page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(90_000);
page.on("pageerror", (error) =>
  browserErrors.push(error.stack ?? error.message),
);
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

async function settle() {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

async function assertViewportIntegrity() {
  const dimensions = await page.evaluate(() => {
    const root = document.querySelector("[data-skillio-motion-root]");
    return {
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      rootOverflowY: root ? getComputedStyle(root).overflowY : null,
    };
  });
  assert.ok(
    dimensions.document <= dimensions.viewport,
    `Document width ${dimensions.document}px exceeds ${dimensions.viewport}px viewport`,
  );
  assert.ok(
    dimensions.rootOverflowY !== "auto" &&
      dimensions.rootOverflowY !== "scroll",
    `Motion root created an inner ${dimensions.rootOverflowY} scroll area`,
  );
}

try {
  const confirmation = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: "akmalramadannn@gmail.com",
    options: {
      redirectTo: `${baseUrl}/auth/confirm?next=/jobs/${job.id}`,
    },
  });
  assert.equal(confirmation.error, null);

  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  assert.ok(tokenHash);

  await page.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/jobs/${job.id}`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForURL(`**/jobs/${job.id}`);
  await settle();

  await page.getByRole("heading", { level: 1, name: job.title }).waitFor();
  assert.equal(
    await page
      .locator("header")
      .getByRole("link", { name: "New job" })
      .count(),
    0,
  );
  await page.getByRole("tab", { name: "Role brief" }).waitFor();
  await page.getByRole("heading", { name: "Job post status" }).waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Applicants", exact: true })
      .isVisible(),
    false,
  );
  await page.getByRole("tab", { name: "Applicants" }).click();
  await page
    .getByRole("heading", { name: "Applicants", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Job stats" }).click();
  await page.getByTestId("source-attribution-panel").waitFor();
  await page.getByRole("tab", { name: "Applicants" }).click();
  await assertViewportIntegrity();
  await page.screenshot({
    path: `${outputDir}/01-job-detail-desktop.png`,
    fullPage: true,
  });

  await page.locator("header button[aria-haspopup='menu']").click();
  await page.getByRole("menu").waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `${outputDir}/02-profile-menu.png`,
    fullPage: false,
  });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle();
  await page
    .getByRole("heading", { name: "Applicants", exact: true })
    .waitFor();
  await assertViewportIntegrity();
  await page.screenshot({
    path: `${outputDir}/03-job-detail-mobile.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/jobs/${job.id}/applicants/${applicationId}`);
  await settle();
  await page.getByRole("heading", { name: "Hiring decision" }).waitFor();
  await page.getByRole("button", { name: "Mark reviewed" }).waitFor();
  await page.getByRole("button", { name: "Accept" }).waitFor();
  await page.getByRole("button", { name: "Reject" }).waitFor();
  await assertViewportIntegrity();
  await page.screenshot({
    path: `${outputDir}/04-applicant-review-desktop.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle();
  await assertViewportIntegrity();
  await page.screenshot({
    path: `${outputDir}/05-applicant-review-mobile.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/jobs/new`);
  await settle();
  await page.getByLabel("Employment type").click();
  await page.getByRole("option", { name: "Full-time" }).waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `${outputDir}/06-employment-select.png`,
    fullPage: false,
  });

  const candidateContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const candidatePage = await candidateContext.newPage();
  await candidatePage.goto(
    `${baseUrl}/apply/${job.publicSlug}?stage=access`,
    { waitUntil: "domcontentloaded" },
  );
  await candidatePage.waitForLoadState("networkidle");
  await candidatePage
    .getByRole("heading", { name: "Choose how to apply" })
    .waitFor();
  const signInHref = await candidatePage
    .getByRole("link", { name: /Sign in with Skilio/ })
    .getAttribute("href");
  assert.ok(signInHref?.includes(encodeURIComponent("?stage=access")));
  await candidateContext.close();

  const actionableBrowserErrors = browserErrors.filter(
    (message) =>
      !message.startsWith("Failed to fetch RSC payload") ||
      !message.includes("Falling back to browser navigation"),
  );
  assert.deepEqual(actionableBrowserErrors, []);

  console.log(
    JSON.stringify(
      {
        jobId: job.id,
        applicationId,
        screenshots: outputDir,
        browserErrors: actionableBrowserErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
