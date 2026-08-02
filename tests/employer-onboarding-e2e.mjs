import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { chromium } from "playwright";

config({ path: "/root/.env" });

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const outputDir = "artifacts/playwright/employer-onboarding-local";
const supabase = createClient(
  process.env.AURAL_SUPABASE_URL,
  process.env.AURAL_SUPABASE_SERVICE_ROLE_KEY,
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
page.on("pageerror", (error) => {
  browserErrors.push(error.stack ?? error.message);
});
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

async function settle() {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

async function assertNoHorizontalOverflow() {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.ok(
    dimensions.documentWidth <= dimensions.viewportWidth,
    `Document width ${dimensions.documentWidth}px exceeds ${dimensions.viewportWidth}px viewport`,
  );
}

try {
  await page.goto(`${baseUrl}/register`, { waitUntil: "domcontentloaded" });
  await settle();
  await page
    .getByRole("heading", { name: "Create your company workspace" })
    .waitFor();
  await page.getByLabel("Your name").fill("Alex Morgan");
  await page.getByLabel("Company name").fill("ABC Company");
  await page.getByLabel("Work email").fill("alex@abc-company.test");
  await page.locator("#password").fill("temporary-password");
  assert.equal(
    await page.getByRole("button", { name: "Create company workspace" }).isEnabled(),
    true,
  );
  await page.screenshot({
    path: `${outputDir}/register-desktop.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow();
  await page.screenshot({
    path: `${outputDir}/register-mobile.png`,
    fullPage: true,
  });

  const confirmation = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: "akmalramadannn@gmail.com",
    options: {
      redirectTo: `${baseUrl}/auth/confirm?next=/settings/members`,
    },
  });
  assert.equal(confirmation.error, null);

  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  assert.ok(tokenHash);

  await page.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/settings/members`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForURL("**/settings/members");
  await settle();
  await page.getByRole("heading", { name: "Team access" }).waitFor();
  await assertNoHorizontalOverflow();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: `${outputDir}/members-desktop.png`,
    fullPage: true,
  });

  const inviteButton = page.getByRole("button", { name: "Invite teammate" });
  if (await inviteButton.isVisible()) {
    await inviteButton.click();
    await page.getByRole("heading", { name: "Invite a teammate" }).waitFor();
    await page.getByLabel("Work email").fill("new.staff@abc-company.test");
    await page.screenshot({
      path: `${outputDir}/invite-dialog-desktop.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel" }).click();
  }

  for (const route of ["/org/settings/members", "/org/members"]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await settle();
    await page.getByRole("heading", { name: "Team access" }).waitFor();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/settings/members`, {
    waitUntil: "domcontentloaded",
  });
  await settle();
  await page.getByRole("heading", { name: "Team access" }).waitFor();
  await assertNoHorizontalOverflow();
  await page.screenshot({
    path: `${outputDir}/members-mobile.png`,
    fullPage: true,
  });

  const actionableErrors = browserErrors.filter(
    (message) =>
      !message.includes("Failed to fetch RSC payload") &&
      !message.includes("Falling back to browser navigation"),
  );
  assert.deepEqual(actionableErrors, []);

  console.log(
    JSON.stringify(
      {
        routes: [
          "/register",
          "/settings/members",
          "/org/settings/members",
          "/org/members",
        ],
        screenshots: outputDir,
        browserErrors: actionableErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
