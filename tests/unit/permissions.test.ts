import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess, homeSection, sectionHref, sections, sectionsFor } from "../../src/lib/permissions";

test("sidebar follows the agreed order", () => {
  assert.deepEqual(
    sections.map((s) => s.key),
    ["overview", "products", "orders", "delivery", "storeDesign", "themes", "callCenters", "landingPages", "analytics", "pixels", "apps", "plans", "settings", "profile"],
  );
});

test("owners see everything, managers all but plans", () => {
  assert.equal(sectionsFor("owner").length, 14);
  assert.ok(!canAccess("manager", "plans"));
  assert.equal(sectionsFor("manager").length, 13);
});

test("call center agents only get orders, call centers and profile", () => {
  assert.deepEqual(sectionsFor("agent").map((s) => s.key), ["orders", "callCenters", "profile"]);
  assert.equal(homeSection("agent").key, "orders");
  assert.equal(homeSection("owner").key, "overview");
});

test("section links", () => {
  assert.equal(sectionHref("ar", "overview"), "/ar/dashboard");
  assert.equal(sectionHref("fr", "storeDesign"), "/fr/dashboard/store-design");
});
