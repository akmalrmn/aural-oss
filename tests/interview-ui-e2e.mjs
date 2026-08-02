import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const employerEmail = process.env.E2E_EMPLOYER_EMAIL;
const outputDir = "artifacts/playwright/interview-ui";

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
const browserErrors = [];

page.setDefaultTimeout(90_000);
page.setDefaultNavigationTimeout(90_000);
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

async function settle() {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

async function viewportAudit(label) {
  const audit = await page.evaluate(() => {
    const width = window.innerWidth;
    const visibleOverflow = Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.position !== "fixed" &&
          bounds.width > 0 &&
          (bounds.left < -1 || bounds.right > width + 1)
        );
      })
      .slice(0, 5)
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
      }));
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: width,
      visibleOverflow,
    };
  });
  assert.ok(
    audit.documentWidth <= audit.viewportWidth + 1,
    `${label} document width ${audit.documentWidth}px exceeds ${audit.viewportWidth}px`,
  );
  assert.deepEqual(audit.visibleOverflow, [], `${label} has visible overflow`);
}

try {
  const confirmation = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: employerEmail,
    options: {
      redirectTo: `${baseUrl}/auth/confirm?next=/assessments`,
    },
  });
  assert.equal(confirmation.error, null);
  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  assert.ok(tokenHash);

  await page.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/assessments`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForURL("**/assessments");

  const desktopRoutes = [
    ["assessment-overview", "/assessments", "Interview assessment workspace"],
    ["interview-manager", "/interviews", "Interviews"],
    ["create-interview", "/interviews/new", "Create interview"],
  ];
  for (const [name, route, heading] of desktopRoutes) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await settle();
    await page.getByRole("heading", { level: 1, name: heading }).waitFor();
    await viewportAudit(`${name} desktop`);
    await page.screenshot({
      path: `${outputDir}/${name}-desktop.png`,
      fullPage: true,
    });
  }

  const mobileRoutes = [
    ["interview-manager", "/interviews", "Interviews"],
    ["questions", "/questions", "Questions"],
    ["sessions", "/candidates", "Sessions"],
  ];
  for (const [name, route, heading] of mobileRoutes) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await settle();
    await page.getByRole("heading", { level: 1, name: heading }).waitFor();
    await viewportAudit(`${name} mobile`);
    await page.screenshot({
      path: `${outputDir}/${name}-mobile.png`,
      fullPage: true,
    });
  }

  assert.ok(
    await page.locator("article").count(),
    "mobile sessions render readable records",
  );
  const mobileTableWidths = await page
    .locator("table")
    .evaluateAll((tables) =>
      tables.map((table) => table.getBoundingClientRect().width),
    );
  assert.ok(
    mobileTableWidths.every((width) => width === 0),
    "desktop session tables stay hidden on mobile",
  );

  const relevantErrors = browserErrors.filter(
    (message) =>
      !message.includes("favicon") &&
      !message.includes("ResizeObserver loop") &&
      !message.startsWith("Failed to fetch RSC payload"),
  );
  assert.deepEqual(relevantErrors, []);

  console.log(
    JSON.stringify({
      ok: true,
      screenshots: outputDir,
      routes: desktopRoutes.length + mobileRoutes.length,
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
