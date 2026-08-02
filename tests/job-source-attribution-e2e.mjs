import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import {
  createTRPCProxyClient,
  httpBatchLink,
} from "@trpc/client";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import superjson from "superjson";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const employerEmail = "akmalramadannn@gmail.com";
const outputDir = "artifacts/playwright/job-source-attribution";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const publicTrpc = createTRPCProxyClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${baseUrl}/api/trpc`,
    }),
  ],
});

await mkdir(outputDir, { recursive: true });

const { data: jobs, error: jobsError } = await supabase
  .from("job_postings")
  .select("id,title,publicSlug,status,job_source_links(*)")
  .eq("status", "ACTIVE")
  .order("updatedAt", { ascending: false })
  .limit(20);
assert.equal(jobsError, null);
const job = jobs.find(
  (item) =>
    item.publicSlug &&
    item.job_source_links.some((link) => link.presetKey === "LINKEDIN"),
);
assert.ok(job, "An active job with preset source links exists");

const browser = await chromium.launch({ headless: true });
const employerContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const employerPage = await employerContext.newPage();
const browserErrors = [];
let customSourceId = null;
let applicationId = null;

employerPage.setDefaultTimeout(60_000);
employerPage.setDefaultNavigationTimeout(90_000);
employerPage.on("pageerror", (error) =>
  browserErrors.push(error.stack ?? error.message),
);
employerPage.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

async function waitForDatabase(check, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.fail(message);
}

try {
  const confirmation = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: employerEmail,
    options: {
      redirectTo: `${baseUrl}/auth/confirm?next=/jobs/${job.id}`,
    },
  });
  assert.equal(confirmation.error, null);
  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  assert.ok(tokenHash);

  await employerPage.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/jobs/${job.id}`,
    { waitUntil: "domcontentloaded" },
  );
  await employerPage.waitForURL(`**/jobs/${job.id}`);
  await employerPage.waitForLoadState("networkidle");
  await employerPage.getByRole("tab", { name: "Job stats" }).click();

  const sourcePanel = employerPage.getByTestId("source-attribution-panel");
  await sourcePanel.getByRole("heading", { name: "Source performance" }).waitFor();
  await sourcePanel.getByText("LinkedIn", { exact: true }).first().waitFor();
  await sourcePanel.getByText("JobStreet", { exact: true }).first().waitFor();
  await sourcePanel.getByText("Indeed", { exact: true }).first().waitFor();

  const customName = `E2E design newsletter ${Date.now()}`;
  await sourcePanel.getByRole("button", { name: "Add source" }).click();
  await sourcePanel.getByLabel("Source name").fill(customName);
  await sourcePanel.getByRole("button", { name: "Create link" }).click();
  await sourcePanel.getByText(customName, { exact: true }).first().waitFor();

  const customSource = await waitForDatabase(async () => {
    const { data } = await supabase
      .from("job_source_links")
      .select("*")
      .eq("jobId", job.id)
      .eq("name", customName)
      .maybeSingle();
    return data;
  }, "Custom source link was not stored");
  customSourceId = customSource.id;

  const linkedinSource = job.job_source_links.find(
    (link) => link.presetKey === "LINKEDIN",
  );
  assert.ok(linkedinSource);

  const candidateContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const candidatePage = await candidateContext.newPage();
  candidatePage.on("pageerror", (error) =>
    browserErrors.push(error.stack ?? error.message),
  );
  candidatePage.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  const customApplyUrl = `${baseUrl}/apply/${job.publicSlug}?src=${encodeURIComponent(customSource.trackingCode)}`;
  await candidatePage.goto(customApplyUrl, { waitUntil: "domcontentloaded" });
  await candidatePage.waitForLoadState("networkidle");
  await candidatePage.waitForFunction(
    (slug) =>
      Boolean(window.localStorage.getItem(`skilio-job-attribution:${slug}`)),
    job.publicSlug,
  );

  const visitorId = await candidatePage.evaluate(
    (slug) => window.localStorage.getItem(`skilio-job-attribution:${slug}`),
    job.publicSlug,
  );
  assert.ok(visitorId, "Tracked visit stores a first-party visitor ID");

  const firstVisit = await waitForDatabase(async () => {
    const { data } = await supabase
      .from("job_source_visits")
      .select("*")
      .eq("jobId", job.id)
      .eq("visitorId", visitorId)
      .maybeSingle();
    return data;
  }, "Tracked visit was not stored");
  assert.equal(firstVisit.sourceLinkId, customSource.id);

  await candidatePage
    .getByRole("button", { name: "Start application" })
    .click();
  await candidatePage
    .getByRole("heading", { name: "Choose how to apply" })
    .waitFor();

  const signInHref = await candidatePage
    .getByRole("link", { name: /Sign in with Skilio/ })
    .getAttribute("href");
  assert.ok(
    signInHref?.includes(encodeURIComponent(customSource.trackingCode)),
    "Skilio sign-in return path preserves the source code",
  );

  await waitForDatabase(async () => {
    const { data } = await supabase
      .from("job_source_visits")
      .select("applicationStartedAt")
      .eq("id", firstVisit.id)
      .single();
    return data?.applicationStartedAt;
  }, "Application start was not attributed");

  await candidatePage.goto(
    `${baseUrl}/apply/${job.publicSlug}?src=${encodeURIComponent(linkedinSource.trackingCode)}`,
    { waitUntil: "domcontentloaded" },
  );
  await candidatePage.waitForLoadState("networkidle");
  const { data: retainedVisit, error: retainedVisitError } = await supabase
    .from("job_source_visits")
    .select("sourceLinkId")
    .eq("jobId", job.id)
    .eq("visitorId", visitorId)
    .single();
  assert.equal(retainedVisitError, null);
  assert.equal(
    retainedVisit.sourceLinkId,
    customSource.id,
    "The first source remains authoritative after another source link is opened",
  );

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const candidateEmail = `source-attribution-${suffix}@example.com`;
  const starterShapes = [
    "CIRCLE",
    "DIAMOND",
    "CROSS",
    "SQUARE",
    "TEE",
    "TRIANGLE",
    "DOT",
    "HEXAGON",
    "SLOPE",
    "LINE",
  ];
  const application = await publicTrpc.job.apply.mutate({
    slug: job.publicSlug,
    source: "GUEST",
    sourceVisitorId: visitorId,
    name: "Source Attribution Candidate",
    email: candidateEmail,
    skills: [],
    links: {},
    profileSnapshot: {},
    screeningAnswers: {},
    drawingResponses: starterShapes.map((starterShape, index) => ({
      starterShape,
      phrase: `Attribution drawing ${index + 1}`,
      imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    })),
  });
  applicationId = application.id;

  const { data: storedApplication, error: storedApplicationError } =
    await supabase
      .from("job_applications")
      .select("sourceLinkId,sourceVisitId,applicationMethod")
      .eq("id", application.id)
      .single();
  assert.equal(storedApplicationError, null);
  assert.equal(storedApplication.sourceLinkId, customSource.id);
  assert.equal(storedApplication.sourceVisitId, firstVisit.id);
  assert.equal(storedApplication.applicationMethod, "GUEST");

  await employerPage.goto(`${baseUrl}/jobs/${job.id}`);
  await employerPage.waitForLoadState("networkidle");
  await employerPage.getByRole("tab", { name: "Job stats" }).click();
  const customRow = employerPage
    .getByTestId("source-attribution-panel")
    .locator("tr")
    .filter({ hasText: customName });
  await customRow.waitFor();
  await customRow.getByText("100%", { exact: true }).waitFor();
  assert.match(await customRow.innerText(), /\b1\b/);
  await employerPage.getByTestId("source-attribution-panel").screenshot({
    path: `${outputDir}/01-source-performance-desktop.png`,
  });

  await employerPage.setViewportSize({ width: 390, height: 844 });
  await employerPage.reload({ waitUntil: "domcontentloaded" });
  await employerPage.waitForLoadState("networkidle");
  const customMobileRecord = employerPage
    .getByTestId("source-attribution-panel")
    .locator("article")
    .filter({ hasText: customName });
  await customMobileRecord.waitFor();
  assert.equal(
    await employerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "Source attribution records do not overflow the mobile viewport",
  );
  await employerPage.getByTestId("source-attribution-panel").screenshot({
    path: `${outputDir}/02-source-performance-mobile.png`,
  });

  await employerPage.setViewportSize({ width: 1440, height: 1000 });
  await employerPage.goto(
    `${baseUrl}/jobs/${job.id}/applicants/${application.id}`,
    { waitUntil: "domcontentloaded" },
  );
  await employerPage.getByText(customName, { exact: true }).waitFor();
  await employerPage
    .getByText("Manual application", { exact: true })
    .waitFor();
  await employerPage.getByRole("button", { name: "Accept" }).click();

  await waitForDatabase(async () => {
    const { data } = await supabase
      .from("job_applications")
      .select("status")
      .eq("id", application.id)
      .single();
    return data?.status === "SHORTLISTED";
  }, "Accepted status was not stored");

  await employerPage.goto(`${baseUrl}/jobs/${job.id}`);
  await employerPage.waitForLoadState("networkidle");
  const acceptedRow = employerPage
    .getByTestId("source-attribution-panel")
    .locator("tr")
    .filter({ hasText: customName });
  await acceptedRow.waitFor();
  const acceptedCells = await acceptedRow.locator("td").allTextContents();
  assert.equal(acceptedCells.at(-2)?.trim(), "1");

  const actionableErrors = browserErrors.filter(
    (message) =>
      !message.includes("favicon") &&
      !message.includes("ResizeObserver loop") &&
      !(
        message.startsWith("Failed to fetch RSC payload") &&
        message.includes("Falling back to browser navigation")
      ),
  );
  assert.deepEqual(actionableErrors, []);
  await candidateContext.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        jobId: job.id,
        sourceLinkId: customSource.id,
        applicationId: application.id,
        screenshots: outputDir,
      },
      null,
      2,
    ),
  );
} finally {
  if (applicationId) {
    await supabase.from("job_applications").delete().eq("id", applicationId);
  }
  if (customSourceId) {
    await supabase.from("job_source_links").delete().eq("id", customSourceId);
  }
  await employerContext.close().catch(() => {});
  await browser.close().catch(() => {});
}
