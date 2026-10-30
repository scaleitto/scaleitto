import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess, entryOf, homeSection, navFor, sectionHref, sections, sectionsFor } from "../../src/lib/permissions";

test("sidebar: the overview, then the sell / grow / storefront / account groups (Zimam's layout)", () => {
  const nav = navFor("owner");
  assert.deepEqual(nav.map((g) => g.key), ["main", "sell", "grow", "storefront", "account"]);
  assert.deepEqual(nav.find((g) => g.key === "sell")!.items.map((e) => e.key), ["products", "orders", "delivery", "callCenters"]);
  assert.deepEqual(nav.find((g) => g.key === "grow")!.items.map((e) => e.key), ["landingPages", "analytics", "pixels", "apps"]);
  assert.deepEqual(nav.find((g) => g.key === "storefront")!.items.map((e) => e.key), ["storeDesign", "themes", "settings"]);
  assert.deepEqual(nav.find((g) => g.key === "account")!.items.map((e) => e.key), ["plans", "profile"]);
  assert.deepEqual(nav.find((g) => g.key === "sell")!.items.find((e) => e.key === "orders")!.children, ["orders", "shipping", "tracking", "returns", "abandoned", "protection"]);
  assert.equal(entryOf("tracking"), "orders");
  assert.equal(entryOf("themes"), "themes");
});

test("owners see everything; managers all but plans and finance", () => {
  assert.equal(sectionsFor("owner").length, sections.length);
  assert.ok(!canAccess("manager", "plans"));
  assert.ok(!canAccess("manager", "finance"));
  assert.ok(canAccess("manager", "inventory"));
  assert.equal(sectionsFor("manager").length, sections.length - 2);
});

test("call center agents only get orders (list, parcels, returns, carts), call centers and profile", () => {
  const nav = navFor("agent");
  assert.deepEqual(nav.map((g) => g.key), ["sell", "account"]);
  assert.deepEqual(nav[0].items.map((e) => e.key), ["orders", "callCenters"]);
  assert.deepEqual(nav[0].items[0].children, ["orders", "shipping", "tracking", "returns", "abandoned"]);
  assert.ok(!canAccess("agent", "protection"));
  assert.equal(homeSection("agent").key, "orders");
  assert.equal(homeSection("owner").key, "overview");
});

test("section links", () => {
  assert.equal(sectionHref("ar", "overview"), "/ar/dashboard");
  assert.equal(sectionHref("fr", "returns"), "/fr/dashboard/orders/returns");
  assert.equal(sectionHref("en", "themes"), "/en/dashboard/store-design/themes");
  assert.equal(sectionHref("ar", "pixels"), "/ar/dashboard/integrations/pixels");
});
