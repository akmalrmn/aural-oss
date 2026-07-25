import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const employerEmail = "akmalramadannn@gmail.com";
const outputDir = "artifacts/playwright/drawing-assessment";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

await mkdir(outputDir, { recursive: true });

const { data: usersData, error: usersError } =
  await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
assert.equal(usersError, null);
const employer = usersData.users.find((user) => user.email === employerEmail);
assert.ok(employer, "Employer account exists");

const { data: membership, error: membershipError } = await supabase
  .from("organization_members")
  .select("workspaceId")
  .eq("userId", employer.id)
  .limit(1)
  .single();
assert.equal(membershipError, null);

const { data: project, error: projectError } = await supabase
  .from("projects")
  .select("id")
  .eq("organizationId", membership.workspaceId)
  .limit(1)
  .single();
assert.equal(projectError, null);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const interviewSlug = `drawing-e2e-${suffix}`;
const jobSlug = `application-steps-e2e-${suffix}`;
const applicationCandidateEmail = `drawmetrics-${suffix}@example.com`;

const { data: interview, error: interviewError } = await supabase
  .from("interviews")
  .insert({
    title: "Visual Thinking Exercise",
    description: "Complete the starter mark and name what you created.",
    userId: employer.id,
    projectId: project.id,
    publicSlug: interviewSlug,
    isActive: true,
    requireInvite: false,
    chatEnabled: true,
    voiceEnabled: false,
    videoEnabled: false,
    timeLimitMinutes: 10,
  })
  .select("id")
  .single();
assert.equal(interviewError, null);

const { data: job, error: jobError } = await supabase
  .from("job_postings")
  .insert({
    projectId: project.id,
    userId: employer.id,
    title: "Product Designer",
    department: "Product",
    location: "Kuala Lumpur / Hybrid",
    employmentType: "Full-time",
    seniority: "Mid-level",
    description: "Design clear, evidence-led product experiences.",
    status: "ACTIVE",
    publicSlug: jobSlug,
    publishedAt: new Date().toISOString(),
  })
  .select("id")
  .single();
assert.equal(jobError, null);
await supabase.from("job_skills").insert([
  {
    jobId: job.id,
    name: "Product Design",
    kind: "HARD",
    priority: "MUST",
    displayOrder: 0,
  },
  {
    jobId: job.id,
    name: "Communication",
    kind: "SOFT",
    priority: "NICE",
    displayOrder: 1,
  },
]);

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
let sessionId = null;
let applicationId = null;

for (const page of [employerPage, candidatePage]) {
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(90_000);
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
}

try {
  const confirmation = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: employerEmail,
    options: {
      redirectTo: `${baseUrl}/auth/confirm?next=/interviews/${interview.id}/edit`,
    },
  });
  assert.equal(confirmation.error, null);
  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  assert.ok(tokenHash);

  await employerPage.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/interviews/${interview.id}/edit`,
    { waitUntil: "domcontentloaded" },
  );
  await employerPage.waitForURL(`**/interviews/${interview.id}/edit`);
  await employerPage.waitForLoadState("networkidle");

  await employerPage.getByRole("button", { name: "Add New" }).click();
  const editor = employerPage.locator(".group.rounded-lg.border").last();
  await editor.getByPlaceholder("Enter the question...").fill(
    "Turn this starter mark into a drawing.",
  );
  await editor.getByRole("combobox").first().click();
  await employerPage
    .getByRole("option", { name: "Drawing Completion" })
    .click();
  await editor.getByRole("combobox").nth(1).click();
  await employerPage.getByRole("option", { name: "Diamond" }).click();
  await editor
    .getByPlaceholder("Helper text for the interviewee...")
    .fill("There is no correct answer. Build on the mark in any direction.");

  await employerPage.screenshot({
    path: `${outputDir}/01-employer-drawing-config.png`,
    fullPage: true,
  });
  await editor.getByRole("button", { name: "Done" }).click();
  await employerPage.getByText("Questions (1)", { exact: true }).waitFor();
  await employerPage
    .getByText("Drawing Completion", { exact: true })
    .waitFor();

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id,type,options")
    .eq("interviewId", interview.id)
    .single();
  assert.equal(questionError, null);
  assert.equal(question.type, "WHITEBOARD");
  assert.equal(question.options.assessmentMode, "DRAWING");
  assert.equal(question.options.starterShape, "DIAMOND");

  await candidatePage.goto(`${baseUrl}/i/${interviewSlug}`);
  await candidatePage.waitForLoadState("networkidle");
  await candidatePage.getByLabel("Your Name").fill("Drawing Candidate");
  await candidatePage
    .getByLabel("Your Email")
    .fill(`drawing-candidate-${suffix}@example.com`);
  await candidatePage.getByRole("button", { name: "Begin Interview" }).click();
  await candidatePage.waitForURL(`**/i/${interviewSlug}/session?sid=*`);
  sessionId = new URL(candidatePage.url()).searchParams.get("sid");
  assert.ok(sessionId);

  await candidatePage.goto(
    `${baseUrl}/i/${interviewSlug}/session?sid=${sessionId}&preview=true`,
  );
  await candidatePage
    .getByRole("heading", {
      name: "Turn this starter mark into a drawing.",
    })
    .waitFor();

  const submitButton = candidatePage.getByRole("button", {
    name: "Save and finish",
  });
  assert.equal(await submitButton.isDisabled(), true);

  const canvas = candidatePage.getByTestId("drawing-assessment-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box);
  await candidatePage.mouse.move(box.x + box.width * 0.32, box.y + box.height * 0.5);
  await candidatePage.mouse.down();
  await candidatePage.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.28, {
    steps: 8,
  });
  await candidatePage.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.5, {
    steps: 8,
  });
  await candidatePage.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.72, {
    steps: 8,
  });
  await candidatePage.mouse.move(box.x + box.width * 0.32, box.y + box.height * 0.5, {
    steps: 8,
  });
  await candidatePage.mouse.up();
  await candidatePage
    .getByLabel("Name your drawing")
    .fill("A window into the future");
  assert.equal(await submitButton.isEnabled(), true);

  await candidatePage.screenshot({
    path: `${outputDir}/02-candidate-drawing-desktop.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 390, height: 844 });
  await candidatePage.screenshot({
    path: `${outputDir}/03-candidate-drawing-mobile.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 1365, height: 900 });

  await submitButton.click();
  await candidatePage
    .getByRole("heading", { name: "Finish interview?" })
    .waitFor();
  await candidatePage.getByRole("button", { name: "Finish interview" }).click();
  await candidatePage.getByRole("heading", { name: "Thank you!" }).waitFor();

  const { data: drawingMessage, error: drawingMessageError } = await supabase
    .from("messages")
    .select("content,questionId,whiteboardData,whiteboardImageUrl")
    .eq("sessionId", sessionId)
    .eq("content", `drawing-assessment-${question.id}`)
    .single();
  assert.equal(drawingMessageError, null);
  assert.equal(drawingMessage.questionId, question.id);
  assert.equal(drawingMessage.whiteboardData.label, "A window into the future");
  assert.equal(drawingMessage.whiteboardData.hardcodedScore, 80);
  assert.ok(drawingMessage.whiteboardImageUrl.startsWith("data:image/png"));

  await employerPage.goto(
    `${baseUrl}/interviews/${interview.id}/results?session=${sessionId}`,
    { waitUntil: "domcontentloaded" },
  );
  await employerPage
    .getByRole("heading", { name: "Visual Thinking Exercise — Session Report" })
    .waitFor();
  await employerPage.screenshot({
    path: `${outputDir}/04-employer-drawing-result.png`,
    fullPage: true,
  });
  const drawingResults = employerPage.getByTestId("drawing-responses");
  await drawingResults.waitFor();
  await drawingResults.getByText("80 / 100", { exact: true }).waitFor();

  await candidatePage.goto(`${baseUrl}/apply/${jobSlug}`);
  await candidatePage.waitForLoadState("networkidle");
  const markers = candidatePage.getByTestId("application-step-marker");
  assert.equal(await markers.count(), 7);
  const markerBoxes = await markers.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  const markerYPositions = markerBoxes.map((marker) => marker.y);
  assert.ok(
    Math.max(...markerYPositions) - Math.min(...markerYPositions) < 1,
    "Application step markers align on one horizontal axis",
  );
  await candidatePage.screenshot({
    path: `${outputDir}/05-application-steps-desktop.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 390, height: 844 });
  await candidatePage.screenshot({
    path: `${outputDir}/06-application-steps-mobile.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 1365, height: 900 });

  await candidatePage
    .getByRole("button", { name: /Continue manually/ })
    .click();
  await candidatePage
    .getByRole("button", { name: "Continue to profile" })
    .click();
  await candidatePage.getByLabel("Full name").fill("Drawmetrics Candidate");
  await candidatePage.getByLabel("Email").fill(applicationCandidateEmail);
  await candidatePage
    .getByRole("button", { name: "Continue to Drawmetrics" })
    .click();
  await candidatePage.getByTestId("drawmetrics-assessment").waitFor();
  await candidatePage.screenshot({
    path: `${outputDir}/07-application-drawmetrics-desktop.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await candidatePage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "Drawmetrics form does not overflow the mobile viewport",
  );
  await candidatePage.screenshot({
    path: `${outputDir}/07b-application-drawmetrics-mobile.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 1365, height: 900 });

  for (let index = 0; index < 10; index += 1) {
    const drawingCanvas = candidatePage.getByTestId(
      "drawing-assessment-canvas",
    );
    await drawingCanvas.scrollIntoViewIfNeeded();
    const drawingBox = await drawingCanvas.boundingBox();
    assert.ok(drawingBox);
    await candidatePage.mouse.move(
      drawingBox.x + drawingBox.width * 0.25,
      drawingBox.y + drawingBox.height * 0.62,
    );
    await candidatePage.mouse.down();
    await candidatePage.mouse.move(
      drawingBox.x + drawingBox.width * 0.5,
      drawingBox.y + drawingBox.height * 0.32,
      { steps: 5 },
    );
    await candidatePage.mouse.move(
      drawingBox.x + drawingBox.width * 0.75,
      drawingBox.y + drawingBox.height * 0.62,
      { steps: 5 },
    );
    await candidatePage.mouse.up();
    await candidatePage
      .getByTestId("drawing-phrase")
      .fill(`Candidate picture ${index + 1}`);
    await candidatePage.getByTestId("save-drawing-response").click();
  }

  const drawingSummary = candidatePage.getByTestId("drawmetrics-summary");
  await drawingSummary.waitFor();
  await drawingSummary
    .getByText("All drawings complete", { exact: true })
    .waitFor();
  assert.equal(
    await drawingSummary
      .getByTestId("drawmetrics-summary-response")
      .count(),
    10,
  );
  await candidatePage.screenshot({
    path: `${outputDir}/08-application-drawmetrics-summary.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await candidatePage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "Drawmetrics summary does not overflow the mobile viewport",
  );
  await candidatePage.screenshot({
    path: `${outputDir}/08b-application-drawmetrics-summary-mobile.png`,
    fullPage: true,
  });
  await candidatePage.setViewportSize({ width: 1365, height: 900 });

  await candidatePage
    .getByRole("button", { name: "Continue to skills" })
    .click();
  await candidatePage
    .getByRole("button", { name: /Product Design/ })
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
  await candidatePage.getByText("10 drawings and 10 phrases attached").waitFor();
  await candidatePage.getByRole("button", { name: "Submit application" }).click();
  await candidatePage
    .getByRole("heading", { name: "Application submitted" })
    .waitFor();

  const { data: application, error: applicationError } = await supabase
    .from("job_applications")
    .select("id,profileSnapshot")
    .eq("jobId", job.id)
    .eq("email", applicationCandidateEmail)
    .single();
  assert.equal(applicationError, null);
  applicationId = application.id;
  const applicationDrawing = application.profileSnapshot.drawingAssessment;
  assert.equal(applicationDrawing.responses.length, 10);
  assert.equal(applicationDrawing.score, 80);
  assert.equal(applicationDrawing.responses[0].phrase, "Candidate picture 1");
  assert.ok(
    applicationDrawing.responses.every((response) =>
      response.imageDataUrl.startsWith("data:image/png;base64,"),
    ),
  );

  await employerPage.goto(
    `${baseUrl}/jobs/${job.id}/applicants/${application.id}`,
    { waitUntil: "domcontentloaded" },
  );
  const employerGallery = employerPage.getByTestId(
    "applicant-drawmetrics-gallery",
  );
  await employerGallery.waitFor();
  assert.equal(await employerGallery.locator("article").count(), 10);
  await employerPage.screenshot({
    path: `${outputDir}/09-employer-application-drawmetrics.png`,
    fullPage: true,
  });
  await employerPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await employerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    "Employer Drawmetrics review does not overflow the mobile viewport",
  );
  await employerPage.screenshot({
    path: `${outputDir}/09b-employer-application-drawmetrics-mobile.png`,
    fullPage: true,
  });
  await employerPage.setViewportSize({ width: 1440, height: 1000 });

  await candidatePage.goto(`${baseUrl}/apply/${jobSlug}`);
  await candidatePage.waitForLoadState("networkidle");
  await candidatePage
    .getByRole("button", { name: /Continue manually/ })
    .click();
  await candidatePage
    .getByRole("button", { name: "Continue to profile" })
    .click();
  await candidatePage.getByLabel("Full name").fill("Drawmetrics Candidate");
  await candidatePage.getByLabel("Email").fill(applicationCandidateEmail);
  await candidatePage
    .getByRole("button", { name: "Continue to Drawmetrics" })
    .click();
  await candidatePage.getByTestId("drawmetrics-reused").waitFor();
  await candidatePage
    .getByText("Your Drawmetrics set is current", { exact: true })
    .waitFor();
  await candidatePage.screenshot({
    path: `${outputDir}/10-application-drawmetrics-reused.png`,
    fullPage: true,
  });
  await candidatePage
    .getByRole("button", { name: "Continue to skills" })
    .click();
  await candidatePage
    .getByRole("button", { name: /Product Design/ })
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
    .getByText("Previous ten-drawing set will be reused")
    .waitFor();
  await candidatePage.getByRole("button", { name: "Submit application" }).click();
  await candidatePage
    .getByRole("heading", { name: "Application submitted" })
    .waitFor();

  const { data: reusedApplications, error: reusedApplicationError } =
    await supabase
      .from("job_applications")
      .select("profileSnapshot")
      .eq("jobId", job.id)
      .eq("email", applicationCandidateEmail)
      .order("submittedAt", { ascending: false })
      .limit(1);
  assert.equal(reusedApplicationError, null);
  assert.equal(reusedApplications.length, 1);
  assert.equal(
    reusedApplications[0].profileSnapshot.drawingAssessmentReused,
    true,
  );
  assert.equal(
    reusedApplications[0].profileSnapshot.drawingAssessment.responses.length,
    10,
  );

  assert.deepEqual(
    browserErrors.filter(
      (message) =>
        !message.includes("favicon") &&
        !message.includes("ResizeObserver loop"),
    ),
    [],
    `Browser console errors: ${browserErrors.join("\n")}`,
  );

  console.log(
    JSON.stringify({
      ok: true,
      interviewId: interview.id,
      sessionId,
      applicationId,
      screenshots: outputDir,
    }),
  );
} finally {
  await employerContext.close().catch(() => {});
  await candidateContext.close().catch(() => {});
  await browser.close().catch(() => {});
  await supabase.from("job_postings").delete().eq("id", job.id);
  await supabase.from("interviews").delete().eq("id", interview.id);
}
