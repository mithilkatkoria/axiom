import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>body{margin:0}</style>${await readFile(new URL("../public/social.svg", import.meta.url), "utf8")}`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(new URL("../public/social.png", import.meta.url)),
  });
} finally {
  await browser.close();
}
