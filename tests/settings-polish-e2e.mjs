import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const outputDir = "/tmp/skilio-settings-polish";
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
page.on("pageerror", (error) => {
  browserErrors.push(error.stack ?? error.message);
});
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

async function settle() {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(350);
}

async function assertViewportIntegrity() {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport,
    `Document width ${dimensions.document}px exceeds ${dimensions.viewport}px viewport`,
  );
}

async function captureRoute(path, name, sectionHeading) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await settle();
  try {
    await page
      .getByRole("heading", { level: 1, name: "Workspace settings" })
      .waitFor();
  } catch (error) {
    console.error(
      JSON.stringify({
        url: page.url(),
        title: await page.title(),
        body: (await page.locator("body").innerText()).slice(0, 2_000),
        browserErrors,
      }),
    );
    throw error;
  }
  await page.getByRole("heading", { name: sectionHeading }).first().waitFor();
  assert.equal(
    await page.locator(`nav[aria-label="Workspace settings"] a[href="${path}"]`).getAttribute("aria-current"),
    "page",
  );
  await assertViewportIntegrity();
  await page.screenshot({
    path: `${outputDir}/${name}-desktop.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle();
  await page.getByRole("heading", { name: sectionHeading }).first().waitFor();
  await assertViewportIntegrity();
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
      redirectTo: `${baseUrl}/auth/confirm?next=/settings`,
    },
  });
  assert.equal(confirmation.error, null);

  const tokenHash = confirmation.data.properties?.hashed_token;
  const verificationType =
    confirmation.data.properties?.verification_type ?? "magiclink";
  const userId = confirmation.data.user?.id;
  assert.ok(tokenHash);
  assert.ok(userId);

  await page.goto(
    `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(verificationType)}&next=/settings`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForURL("**/settings");

  await captureRoute(
    "/settings",
    "general",
    /Workspace identity|No workspace selected/,
  );
  await captureRoute(
    "/settings/members",
    "members",
    /Team access|No company selected/,
  );

  if (await page.getByRole("button", { name: "Invite teammate" }).count()) {
    await page.getByRole("button", { name: "Invite teammate" }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Send invitation" }).isDisabled(),
      true,
    );
    await page.keyboard.press("Escape");
  }

  await captureRoute("/settings/api-keys", "api-keys", "Developer access");
  assert.equal(
    await page.getByRole("button", { name: /Copy full key/i }).count(),
    0,
  );

  await page.getByLabel("Expiration (optional)").fill("2020-01-01T00:00");
  await page.getByText("Choose a date and time in the future.").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Create API key" }).isDisabled(),
    true,
  );

  const { data: storedKeys, error: keysError } = await supabase
    .from("api_keys")
    .select("key")
    .eq("userId", userId);
  assert.equal(keysError, null);
  const pageText = await page.locator("body").innerText();
  for (const storedKey of storedKeys ?? []) {
    assert.equal(
      pageText.includes(storedKey.key),
      false,
      "The complete stored API key must not be rendered in the list",
    );
  }

  const actionableBrowserErrors = browserErrors.filter(
    (message) =>
      !message.startsWith("Failed to fetch RSC payload") &&
      !message.includes("Falling back to browser navigation"),
  );
  assert.deepEqual(actionableBrowserErrors, []);

  console.log(
    JSON.stringify(
      {
        routes: ["/settings", "/settings/members", "/settings/api-keys"],
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
