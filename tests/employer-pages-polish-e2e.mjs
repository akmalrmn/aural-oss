import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const outputDir = "artifacts/playwright/employer-polish-after";
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

async function assertNoDocumentOverflow() {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport,
    `Document width ${dimensions.document}px exceeds ${dimensions.viewport}px viewport`,
  );
}

async function captureRoute(path, name, heading) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await settle();
  await page.getByRole("heading", { level: 1, name: heading }).waitFor();
  await page.screenshot({
    path: `${outputDir}/${name}-desktop.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle();
  await page.getByRole("heading", { level: 1, name: heading }).waitFor();
  await assertNoDocumentOverflow();
  await page.screenshot({
    path: `${outputDir}/${name}-mobile.png`,
    fullPage: true,
  });
}

try {
  const confirmation = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: "akmalramadannn@gmail.com",
    options: {
      redirectTo: `${baseUrl}/auth/confirm?next=/dashboard`,
    },
  });
  assert.equal(confirmation.error, null);

  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  assert.ok(tokenHash);

  await page.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/dashboard`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForURL("**/dashboard");

  await captureRoute("/dashboard", "dashboard", "Hiring overview");
  await captureRoute("/jobs", "jobs", "Jobs");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/jobs`);
  await settle();
  await page.getByLabel("Search jobs").fill("no-role-can-match-this-query");
  await page.getByText("No jobs match this view").waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Closed" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Closed" }).getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "All", exact: true }).click();

  await captureRoute("/applicants", "applicants", "Applicants");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/applicants`);
  await settle();
  await page.getByLabel("Search applicants").fill("no-applicant-can-match-this-query");
  await page.getByText("No applicants match this view").waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Shortlisted" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Shortlisted" })
      .getAttribute("aria-pressed"),
    "true",
  );

  const actionableBrowserErrors = browserErrors.filter(
    (message) =>
      !message.startsWith("Failed to fetch RSC payload") ||
      !message.includes("Falling back to browser navigation"),
  );
  assert.deepEqual(actionableBrowserErrors, []);
  console.log(
    JSON.stringify(
      {
        routes: ["/dashboard", "/jobs", "/applicants"],
        screenshots: outputDir,
        browserErrors: actionableBrowserErrors,
        ignoredPrefetchCancellations:
          browserErrors.length - actionableBrowserErrors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
