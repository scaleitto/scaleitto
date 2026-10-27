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
import { startMockCarriers } from "./mock-carriers.mjs";
import { startMockOpenAi } from "./mock-openai.mjs";

const phases = { phase0, phase1, phase2, phase3, phase4, phase5, phase6, phase7, phase8 };
const only = process.argv[2];

// The fake delivery company server (the app under test must have the same E2E_CARRIER_URL)
const mock = process.env.E2E_CARRIER_URL ? await startMockCarriers(Number(new URL(process.env.E2E_CARRIER_URL).port)) : null;
// The fake OpenAI server, only when the app is pointed at a local one
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
await db.end();
console.log(failed() ? `\n✗ ${failed()} failing step(s)` : "\n✓ all steps passed");
process.exit(failed() ? 1 : 0);
