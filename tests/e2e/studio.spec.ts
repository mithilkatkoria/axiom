import { test, expect, type Page } from "@playwright/test";
const consoleProblems = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  consoleProblems.set(page, problems);
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(consoleProblems.get(page)).toEqual([]);
});

async function ready(page: Page) {
  await expect(page.getByRole("button", { name: /^Run/ }).first()).toBeEnabled({
    timeout: 15000,
  });
}
async function edit(page: Page, source: string) {
  const editor = page.getByRole("textbox", { name: "Axiom source code" });
  await editor.fill(source);
  await expect(page.locator(".studio-statusbar")).not.toContainText(
    "Compiling",
  );
}
test("homepage runs the real compiler", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The language, in motion." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run homepage example" }).click();
  await expect(page.locator(".demo-output pre")).toHaveText("120");
  expect(errors).toEqual([]);
});
test("homepage example selection updates real execution and inspectors", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Short circuit", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Short circuit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Run homepage example" }).click();
  await expect(page.locator(".demo-output pre")).toHaveText("false\ntrue");
  await page.getByRole("tab", { name: "Bytecode" }).click();
  await expect(page.locator(".home-inspection")).toContainText("JUMP");
  await expect(page.locator(".home-inspection")).toContainText("PRINT");
});
test("fragment share links load source without executing", async ({ page }) => {
  await page.goto("/studio#code=" + encodeURIComponent("print(91);"));
  await ready(page);
  await expect(
    page.getByRole("textbox", { name: "Axiom source code" }),
  ).toContainText("print(91)");
  await expect(page.locator(".output-line")).toHaveCount(0);
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("91");
});
test("all compiler panels update from edited source", async ({ page }) => {
  await page.goto("/studio");
  await ready(page);
  await edit(page, "let x: number = 10;\nlet y: number = 20;\nprint(x + y);");
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("30");
  await page.getByRole("tab", { name: "Tokens" }).click();
  await expect(
    page.getByRole("button", { name: "x", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Types" }).click();
  await expect(page.getByText("Static analysis complete")).toBeVisible();
  await page.getByRole("tab", { name: "Bytecode" }).click();
  await expect(
    page.getByRole("button", { name: "ADD", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "AST", exact: true }).click();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Variable · x/ }),
  ).toBeVisible();
});
test("diagnostics navigate source and stale output clears", async ({
  page,
}) => {
  await page.goto("/studio");
  await ready(page);
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("120");
  await edit(page, 'let age: number = "seventeen";');
  await expect(page.locator(".diagnostic-line")).toContainText(
    "Expected 'number', received 'string'.",
  );
  await expect(page.locator(".output-line")).toHaveCount(0);
  await page.locator(".diagnostic-line").click();
  await expect(
    page.getByRole("textbox", { name: "Axiom source code" }),
  ).toBeFocused();
  await edit(page, "print(10 + );");
  await expect(page.locator(".diagnostic-line")).toContainText(
    "Expected an expression",
  );
});
test("debugger exposes real frames, steps, and reset", async ({ page }) => {
  await page.goto("/studio");
  await ready(page);
  await page
    .getByRole("button", { name: "Step instruction", exact: true })
    .click();
  await expect(page.locator(".runtime-readout").first()).toContainText("0001");
  await page
    .getByRole("button", { name: "Step instruction", exact: true })
    .click();
  await expect(page.locator(".call-stack")).toContainText("factorial");
  await expect(page.locator(".value").first()).toContainText("5");
  await page.getByRole("button", { name: "Step out", exact: true }).click();
  await expect(page.locator(".call-stack button")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset execution" }).click();
  await expect(page.locator(".runtime-readout")).toContainText("0000");
});
test("breakpoint pauses recursion and continue finishes", async ({ page }) => {
  await page.goto("/studio");
  await ready(page);
  const gutter = page.locator(".cm-breakpoints .cm-gutterElement");
  await gutter.nth(3).click();
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.getByRole("button", { name: /^Continue/ })).toBeVisible();
  await page.getByRole("tab", { name: "Runtime" }).click();
  await expect(page.locator(".call-stack")).toContainText("factorial");
  await expect(page.locator(".cm-execution-line")).toBeVisible();
  await page.getByRole("button", { name: "Clear breakpoints" }).click();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.locator(".output-line pre")).toHaveText("120");
});
test("infinite loop is bounded, stop resets safely", async ({ page }) => {
  await page.goto("/studio");
  await ready(page);
  await edit(page, "while (true) {}");
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".diagnostic-line")).toContainText(
    "Instruction budget exhausted",
    { timeout: 15000 },
  );
  await edit(page, "print(false && (1 / 0 > 0));");
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("false");
  await page.getByRole("button", { name: "Reset execution" }).click();
  await page
    .getByRole("button", { name: "Step instruction", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop execution" }).click();
  await expect(
    page.getByText("Execution terminated. Reset to create a fresh worker."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset execution" }).click();
  await ready(page);
});
test("source navigation selects exact token and bytecode ranges", async ({
  page,
}) => {
  await page.goto("/studio");
  await ready(page);
  await edit(page, "print(42);");
  await page.getByRole("tab", { name: "Tokens" }).click();
  await page.getByRole("button", { name: "42", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => getSelection()?.toString()))
    .toBe("42");
  await expect(
    page.getByRole("textbox", { name: "Axiom source code" }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "Bytecode" }).click();
  await page.getByRole("button", { name: "PRINT", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Axiom source code" }),
  ).toBeFocused();
});
test("theme, resizing, command menu, and persistence", async ({ page }) => {
  await page.goto("/studio");
  await ready(page);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const divider = page.getByRole("separator", {
    name: "Resize editor and inspector",
  });
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "51");
  await page.getByRole("button", { name: "Open command menu" }).click();
  await page.getByRole("textbox", { name: "Search commands" }).fill("Hello");
  await page.getByRole("button", { name: "Load Hello, Axiom" }).click();
  await ready(page);
  await expect(
    page.getByRole("textbox", { name: "Axiom source code" }),
  ).toContainText("Hello, world!");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("textbox", { name: "Axiom source code" }),
  ).toContainText("Hello, world!");
});
test("documentation navigation and examples work", async ({ page }) => {
  for (const path of ["/language", "/learn", "/architecture"]) {
    await page.goto(path);
    await expect(page.locator("article h1")).toBeVisible();
  }
  await page.goto("/language");
  await page.getByRole("button", { name: "Explore in studio" }).first().click();
  await ready(page);
  await expect(page).toHaveURL("/studio");
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("18");
});
test("benchmarks measure verified programs and export", async ({ page }) => {
  await page.goto("/experiments");
  await expect(page.getByText("No measurements yet.")).toBeVisible();
  await page.getByRole("button", { name: "Run benchmarks" }).click();
  await expect(page.locator(".benchmark-table tbody tr")).toHaveCount(7, {
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "Run benchmarks" }),
  ).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("axiom-benchmark.json");
});
test("shared code is loaded but never auto-run", async ({ page }) => {
  await page.goto("/studio?code=" + encodeURIComponent("print(73);"));
  await ready(page);
  await expect(page.locator(".output-line")).toHaveCount(0);
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("73");
});
for (const width of [375, 768, 1280, 1440])
  test(`responsive visual QA at ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Run homepage example" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("textbox", { name: "Axiom source code" }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/home-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/studio");
    await ready(page);
    await page.screenshot({
      path: `docs/screenshots/studio-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 760)
      await page.getByRole("button", { name: "Inspect", exact: true }).click();
    await page.getByRole("button", { name: "Fit tree" }).click();
    await page.screenshot({
      path: `docs/screenshots/ast-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (width < 760)
      await page.getByRole("button", { name: "Source", exact: true }).click();
    await page
      .getByRole("button", { name: "Step instruction", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Step instruction", exact: true })
      .click();
    if (width < 760)
      await page.getByRole("button", { name: "Inspect", exact: true }).click();
    await page.screenshot({
      path: `docs/screenshots/debugger-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await page.screenshot({
      path: `docs/screenshots/light-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (width < 760)
      await page.getByRole("button", { name: "Source", exact: true }).click();
    await edit(page, 'let x: number = "invalid";');
    await expect(page.locator(".diagnostic-line")).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/error-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  });

test("production documentation remains readable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: "http://127.0.0.1:5178",
  });
  try {
    const page = await context.newPage();
    for (const [path, title] of [
      ["/language", "Small language. Clear rules."],
      ["/learn", "Follow the transformation."],
      ["/architecture", "One engine. Every view."],
    ]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(page.locator("article section")).not.toHaveCount(0);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        title + " | Axiom",
      );
    }
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "The language, in motion." }),
    ).toBeVisible();
    expect((await page.request.get("/social.png")).status()).toBe(200);
  } finally {
    await context.close();
  }
});
test("pause preserves the VM for continuation", async ({ page }) => {
  await page.goto("/studio");
  await ready(page);
  await edit(page, "while (true) {}");
  await ready(page);
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await page.getByRole("button", { name: "Pause execution" }).click();
  await expect(page.getByRole("button", { name: /^Continue/ })).toBeEnabled();
  await page.getByRole("tab", { name: "Runtime" }).click();
  await expect(page.locator(".runtime-readout")).toBeVisible();
  await page.getByRole("button", { name: "Stop execution" }).click();
  await expect(
    page.getByText("Execution terminated. Reset to create a fresh worker."),
  ).toBeVisible();
});
test("compact phone and keyboard breakpoint remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/studio");
  await ready(page);
  await edit(page, "print(1);\nprint(2);");
  await ready(page);
  const editor = page.getByRole("textbox", { name: "Axiom source code" });
  await editor.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("F9");
  await expect(
    page.getByRole("button", { name: "Clear breakpoints" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.getByRole("button", { name: /^Continue/ })).toBeEnabled();
  await expect(page.locator(".run-button")).toHaveCSS(
    "background-color",
    "rgb(237, 120, 91)",
  );
  const terminal = await page.locator(".terminal-panel").boundingBox();
  const footer = await page.locator(".studio-statusbar").boundingBox();
  expect(terminal!.y + terminal!.height).toBeLessThanOrEqual(667);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(667);
  await page.screenshot({
    path: "docs/screenshots/studio-375-compact.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("AST expressions reveal their real mapped instructions", async ({
  page,
}) => {
  await page.goto("/studio");
  await ready(page);
  await edit(page, "print(2 + 3);");
  await ready(page);
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("button", { name: "Expand Call", exact: true }).click();
  await page.getByRole("button", { name: /Binary · \+/ }).click();
  await expect(page.locator(".mapped-instructions summary")).toHaveText(
    "3 instructions mapped to source",
  );
  await page.locator(".mapped-instructions summary").click();
  await expect(page.locator(".mapping-list button")).toHaveCount(3);
  await page.locator(".mapping-list button").filter({ hasText: "ADD" }).click();
  await expect
    .poll(() => page.evaluate(() => getSelection()?.toString()))
    .toBe("2 + 3");
});

test("AST exploration preserves source statement order", async ({ page }) => {
  await page.goto("/studio");
  await ready(page);
  const fn = await page
    .locator(".ast-node")
    .filter({ hasText: "Function" })
    .boundingBox();
  const variable = await page
    .locator(".ast-node")
    .filter({ hasText: "Variable" })
    .boundingBox();
  const expression = await page
    .locator(".ast-node")
    .filter({ hasText: "Expression" })
    .boundingBox();
  expect(fn!.y).toBeLessThan(variable!.y);
  expect(variable!.y).toBeLessThan(expression!.y);
});

test("production compiler and VM execute in Rust WebAssembly", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", (event) => {
          if (event.data.compilation?.engine)
            (window as unknown as { axiomEngine: unknown }).axiomEngine =
              event.data.compilation.engine;
        });
      }
    };
  });
  const binary = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(".wasm"),
  );
  await page.goto("/studio");
  await ready(page);
  const response = await binary;
  expect(response.status()).toBe(200);
  expect([...new Uint8Array(await response.body()).slice(0, 4)]).toEqual([
    0, 97, 115, 109,
  ]);
  expect(
    await page.evaluate(
      () => (window as unknown as { axiomEngine: unknown }).axiomEngine,
    ),
  ).toMatchObject({ language: "Rust", runtime: "WebAssembly", abi: 1 });
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(page.locator(".output-line pre")).toHaveText("120");
});
