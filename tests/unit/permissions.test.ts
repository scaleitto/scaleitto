import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess, groupOf, homeSection, navFor, sectionHref, sections, sectionsFor } from "../../src/lib/permissions";

test("sidebar follows the agreed order, with sub-sections grouped", () => {
  assert.deepEqual(
    navFor("owner").map((g) => g.key),
    ["overview", "orders", "products", "inventory", "delivery", "callCenters", "storeDesign", "landingPages", "integrations", "analytics", "finance", "plans", "settings", "profile"],
  );
  const orders = navFor("owner").find((g) => g.key === "orders")!;
  assert.deepEqual(orders.children, ["orders", "shipping", "tracking", "returns", "abandoned", "protection", "orderInsights"]);
  assert.deepEqual(navFor("owner").find((g) => g.key === "storeDesign")!.children, ["storeDesign", "themes", "orderForm"]);
  assert.deepEqual(navFor("owner").find((g) => g.key === "integrations")!.children, ["pixels", "apps"]);
  // Every page belongs to exactly one group
  for (const s of sections) assert.ok(groupOf(s.key), s.key);
});

test("owners see everything; managers all but plans and finance", () => {
  assert.equal(sectionsFor("owner").length, sections.length);
  assert.ok(!canAccess("manager", "plans"));
  assert.ok(!canAccess("manager", "finance"));
  assert.ok(canAccess("manager", "inventory"));
  assert.equal(sectionsFor("manager").length, sections.length - 2);
});

test("call center agents only get orders (list, parcels, returns, carts), call centers and profile", () => {
  assert.deepEqual(navFor("agent").map((g) => g.key), ["orders", "callCenters", "profile"]);
  assert.deepEqual(navFor("agent")[0].children, ["orders", "shipping", "tracking", "returns", "abandoned"]);
  assert.ok(!canAccess("agent", "protection") && !canAccess("agent", "orderInsights"));
  assert.equal(homeSection("agent").key, "orders");
  assert.equal(homeSection("owner").key, "overview");
});

test("section links", () => {
  assert.equal(sectionHref("ar", "overview"), "/ar/dashboard");
  assert.equal(sectionHref("fr", "returns"), "/fr/dashboard/orders/returns");
  assert.equal(sectionHref("en", "themes"), "/en/dashboard/store-design/themes");
  assert.equal(sectionHref("ar", "pixels"), "/ar/dashboard/integrations/pixels");
});
