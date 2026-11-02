import { chromium } from "playwright";
import { BASE, createShop } from "./helpers.mjs";
const browser = await chromium.launch();
const { context } = await createShop(browser, { viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
for (const [url, name] of [["channels", "channels"], ["call-centers", "callcenter"]]) {
  await page.goto(`${BASE}/en/dashboard/${url}`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/tmp/claude-0/ours/${name}.png`, fullPage: true });
}
await browser.close();
process.exit(0);
