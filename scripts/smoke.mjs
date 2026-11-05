import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5178").origin;
const browser = await chromium.launch();
const failures = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      failures.push(message.text());
  });
  for (const path of [
    "/",
    "/studio",
    "/start",
    "/language",
    "/learn",
    "/architecture",
    "/experiments",
    "/social.png",
  ]) {
    const response = await context.request.get(origin + path);
    expect(response.status(), path).toBe(200);
  }
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        this.addEventListener("message", (event) => {
          if (event.data.compilation?.engine)
            window.axiomEngine = event.data.compilation.engine;
        });
      }
    };
  });
  const wasmResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(".wasm"),
  );
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Run homepage example" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Axiom source code" }),
  ).toBeVisible();
  const wasm = await wasmResponse;
  expect(wasm.status()).toBe(200);
  expect([...new Uint8Array(await wasm.body()).slice(0, 4)]).toEqual([
    0, 97, 115, 109,
  ]);
  expect(await page.evaluate(() => window.axiomEngine)).toMatchObject({
    language: "Rust",
    runtime: "WebAssembly",
    abi: 1,
  });
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      document.fonts.check('400 16px "Instrument Sans Variable"'),
    ),
  ).toBe(true);
  await mkdir(new URL("../docs/screenshots/", import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: fileURLToPath(
      new URL("../docs/screenshots/home-hero.png", import.meta.url),
    ),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Run homepage example" }).click();
  await expect(page.locator(".demo-output pre")).toHaveText("120");
  await page.goto(
    origin + "/studio#code=" + encodeURIComponent("print(2 + 3 * 4);"),
  );
  await expect(
    page.getByRole("button", { name: /^Run/ }).first(),
  ).toBeEnabled();
  await expect(page.locator(".output-line")).toHaveCount(0);
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("14");
  await page.setViewportSize({ width: 375, height: 667 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + "/start");
  await page
    .getByRole("button", { name: "Run and check", exact: true })
    .click();
  await expect(page.locator(".course-feedback.is-passed")).toBeVisible();
  await expect(page.getByText("1 of 6 lessons completed")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Axiom source code" })
    .fill('print("Score: " + str(12)); print(len("🦀"));');
  await page.getByRole("button", { name: /Inspect this program/ }).click();
  await expect(page).toHaveURL(origin + "/studio");
  await expect(
    page.getByRole("button", { name: /^Run/ }).first(),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText(["Score: 12", "1"]);
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  for (const path of ["/language", "/learn", "/architecture"]) {
    await staticPage.goto(origin + path);
    await expect(staticPage.locator("article h1")).toBeVisible();
  }
  await staticPage.goto(origin + "/start");
  await expect(
    staticPage.getByRole("heading", {
      name: "Your first Axiom program.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(staticPage.locator(".article-section")).toHaveCount(6);
  if (origin.startsWith("https:")) {
    const start = await (await context.request.get(origin + "/start")).text();
    expect(start).toContain('rel="canonical" href="' + origin + '/start"');
    const home = await (await context.request.get(origin)).text();
    expect(home).toContain(`rel="canonical" href="${origin}/"`);
    expect(home).toContain(`${origin}/social.png`);
    const sitemap = await context.request.get(origin + "/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain(origin + "/language");
  }
  expect(failures).toEqual([]);
  console.log(
    `Release smoke passed: ${origin}. Routes, real Rust/WebAssembly execution, shared source, beginner lessons, string helpers, mobile, static documentation, fonts and metadata checked.`,
  );
} finally {
  await browser.close();
}
