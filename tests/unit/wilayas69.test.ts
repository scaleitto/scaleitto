import { test } from "node:test";
import assert from "node:assert/strict";
import { carrierWilaya, parentWilaya, wilayas, WILAYA_COUNT } from "../../src/lib/wilayas";
import { communesOf } from "../../src/lib/communes";
import { applyDelivery, resolveDelivery } from "../../src/features/delivery/settings";
import { wilayaPaths } from "../../src/lib/algeria-map";

test("69 wilayas: every one has communes and a map outline; couriers get the former wilaya", () => {
  assert.equal(WILAYA_COUNT, 69);
  for (const w of wilayas) assert.ok(communesOf(w.code).length > 0, `communes of ${w.code}`);
  assert.equal(wilayas.reduce((n, w) => n + communesOf(w.code).length, 0), 1541);
  assert.ok(communesOf(59).some(([fr]) => fr === "Aflou"));
  assert.ok(!communesOf(3).some(([fr]) => fr === "Aflou"));
  assert.deepEqual(new Set(wilayaPaths.map(([c]) => c)), new Set(wilayas.map((w) => w.code)));
  assert.equal(parentWilaya(68), 28);
  assert.equal(parentWilaya(16), 16);
  assert.deepEqual(carrierWilaya(68), { code: 28, fr: "M'Sila", ar: "المسيلة" });
});

test("69 wilayas: a new wilaya not priced yet takes its former wilaya's price, an explicit choice wins", () => {
  const settings = resolveDelivery({
    enabled: true,
    options: [{ id: "a", name: "Normal", type: "both", pricing: "wilaya", active: true, isDefault: true, rates: { 28: { state: "paid", home: 700, office: 400 }, 3: { state: "paid", home: 800, office: 500 }, 59: { state: "none" } } }],
  });
  assert.deepEqual(settings.options[0].rates?.[68], { state: "paid", home: 700, office: 400 });
  const rates = applyDelivery({}, settings);
  assert.deepEqual(rates[68], { home: 700, office: 400 });
  assert.deepEqual(rates[59], { home: null, office: null });
  // Older stores priced from the shared table only
  const table = applyDelivery({ 17: { home: 650, office: null } }, resolveDelivery({ enabled: true }));
  assert.deepEqual(table[65], { home: 650, office: null });
  assert.deepEqual(table[66], { home: 650, office: null });
});
