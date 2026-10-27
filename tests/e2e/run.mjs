// Runs every end-to-end phase against a running server (E2E_URL, default http://localhost:3000)
// and checks that no server error was logged while testing.
import { BASE, db, failed, playwright, step, expect } from "./helpers.mjs";
import phase0 from "./phase0.mjs";
import phase1 from "./phase1.mjs";
import phase2 from "./phase2.mjs";
import phase3 from "./phase3.mjs";
import phase4 from "./phase4.mjs";
import phase5 from "./phase5.mjs";
import phase6 from "./phase6.mjs";
import phase7 from "./phase7.mjs";
import phase8 from "./phase8.mjs";
import phase9 from "./phase9.mjs";
import phase10 from "./phase10.mjs";
import phase11 from "./phase11.mjs";
import phase12 from "./phase12.mjs";
import { startMockCarriers } from "./mock-carriers.mjs";
import { startMockOpenAi } from "./mock-openai.mjs";
import { startMockPixels } from "./mock-pixels.mjs";
import { startMockApps } from "./mock-apps.mjs";

const phases = { phase0, phase1, phase2, phase3, phase4, phase5, phase6, phase7, phase8, phase9, phase10, phase11, phase12 };
const only = process.argv[2];

// The fake delivery company server (the app under test must have the same E2E_CARRIER_URL)
const mock = process.env.E2E_CARRIER_URL ? await startMockCarriers(Number(new URL(process.env.E2E_CARRIER_URL).port)) : null;
// The fake OpenAI server, only when the app is pointed at a local one
// The fake Meta / TikTok / Google server for server-side pixel events
const pixelMock = process.env.E2E_PIXEL_URL ? await startMockPixels(Number(new URL(process.env.E2E_PIXEL_URL).port)) : null;
// The fake Google Sheets script, webhook receiver, Shopify store and YouCan API
const appsMock = process.env.E2E_APPS_URL ? await startMockApps(Number(new URL(process.env.E2E_APPS_URL).port)) : null;
const ai = process.env.OPENAI_BASE_URL?.startsWith("http://127.0.0.1") ? await startMockOpenAi(Number(new URL(process.env.OPENAI_BASE_URL).port)) : null;

const { chromium } = playwright();
const browser = await chromium.launch();
const errorCount = async () => (await db.query("SELECT COUNT(*) AS n FROM error_logs"))[0][0].n;
const before = await errorCount();

console.log(`E2E against ${BASE}`);
for (const [name, run] of Object.entries(phases)) {
  if (only && only !== name) continue;
  console.log(`\n${name}`);
  await run(browser);
}

await step("no server errors were logged during the tests", async () => {
  const [rows] = await db.query("SELECT path, message FROM error_logs ORDER BY created_at DESC LIMIT ?", [(await errorCount()) - before]);
  expect(rows.length === 0, `no new errors (got: ${rows.map((r) => `${r.path}: ${r.message}`).join(" | ")})`);
});

await browser.close();
mock?.close();
ai?.close();
pixelMock?.close();
appsMock?.close();
await db.end();
console.log(failed() ? `\n✗ ${failed()} failing step(s)` : "\n✓ all steps passed");
process.exit(failed() ? 1 : 0);
