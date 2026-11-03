// Runs every end-to-end phase against a running server (E2E_URL, default http://localhost:3000)
// and checks that no server error was logged while testing.
import { BASE, BROWSER_ARGS, db, failed, playwright, step, expect } from "./helpers.mjs";
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
import phase13 from "./phase13.mjs";
import phase14 from "./phase14.mjs";
import phase15 from "./phase15.mjs";
import phase16 from "./phase16.mjs";
import phase17 from "./phase17.mjs";
import phase18 from "./phase18.mjs";
import phase20 from "./phase20.mjs";
import phase21 from "./phase21.mjs";
import phase22 from "./phase22.mjs";
import phase23 from "./phase23.mjs";
import phase24 from "./phase24.mjs";
import phase26 from "./phase26.mjs";
import phase27 from "./phase27.mjs";
import phase28 from "./phase28.mjs";
import phase29 from "./phase29.mjs";
import phase30 from "./phase30.mjs";
import phase31 from "./phase31.mjs";
import phase32 from "./phase32.mjs";
import phase33 from "./phase33.mjs";
import phase34 from "./phase34.mjs";
import phase35 from "./phase35.mjs";
import phase36 from "./phase36.mjs";
import { startMockCarriers } from "./mock-carriers.mjs";
import { startMockOpenAi } from "./mock-openai.mjs";
import { startMockPixels } from "./mock-pixels.mjs";
import { startMockApps } from "./mock-apps.mjs";

const phases = { phase0, phase1, phase2, phase3, phase4, phase5, phase6, phase7, phase8, phase9, phase10, phase11, phase12, phase13, phase14, phase15, phase16, phase17, phase18, phase20, phase21, phase22, phase23, phase24, phase26, phase27, phase28, phase29, phase30, phase31, phase32, phase33, phase34, phase35, phase36 };
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
const browser = await chromium.launch({ args: BROWSER_ARGS });
// Errors logged since the tests started (by time, so the admin's "clear the log" does not hide or break anything)
const [[{ startedAt }]] = await db.query("SELECT NOW() AS startedAt");

console.log(`E2E against ${BASE}`);
for (const [name, run] of Object.entries(phases)) {
  if (only && only !== name) continue;
  console.log(`\n${name}`);
  await run(browser);
}

await step("every table stores Arabic text (utf8mb4, even when the database started as latin1)", async () => {
  const [rows] = await db.query("SELECT TABLE_NAME AS name, TABLE_COLLATION AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_COLLATION NOT LIKE 'utf8mb4%'");
  expect(rows.length === 0, `tables not in utf8mb4: ${rows.map((r) => `${r.name} (${r.c})`).join(", ")}`);
});

await step("no server errors were logged during the tests", async () => {
  const [rows] = await db.query("SELECT path, message FROM error_logs WHERE created_at >= ? AND message NOT LIKE 'e2e-sample%' ORDER BY created_at DESC LIMIT 20", [startedAt]);
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
