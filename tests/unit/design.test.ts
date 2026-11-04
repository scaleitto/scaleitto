import { test } from "node:test";
import assert from "node:assert/strict";
import { globalSchema } from "../../src/features/design/validators";
import { defaultDesign, resolveDesign } from "../../src/features/design/types";
import { navHref, navTarget, sanitizePages, sanitizeSection } from "../../src/features/design/builder";
import { fieldErrorsFrom } from "../../src/lib/validation";

test("old or partial saved designs get the defaults", () => {
  assert.deepEqual(resolveDesign(null), defaultDesign);
  const d = resolveDesign({ hero: { title: "Hi" }, showBadges: false, unknown: 1 });
  assert.equal(d.hero.title, "Hi");
  assert.equal(d.showBadges, false);
  assert.equal(d.socials.facebook, "");
  assert.equal(d.navigation.enabled, true);
  assert.equal(d.footer.enabled, true);
});

test("a store designed before the builder keeps its home page as sections", () => {
  const d = resolveDesign({ hero: { enabled: true, title: "Soldes", image: "/uploads/a/b.webp" }, productsTitle: "Nouveautés", showBadges: false, showOrderSteps: true });
  assert.deepEqual(d.pages.home.map((s) => [s.type, s.hidden]), [["hero", false], ["badges", true], ["collections", false], ["products", false], ["steps", false]]);
  const products = d.pages.home.find((s) => s.type === "products");
  assert.equal(products?.type === "products" && products.title, "Nouveautés");
  // No draft yet = the published pages
  assert.deepEqual(d.draft, d.pages);
  // A banner switched off keeps its text, hidden
  assert.equal(resolveDesign({ hero: { enabled: false, title: "Old" } }).pages.home[0].hidden, true);
});

test("pages: unknown sections, unsafe links and duplicate handles are dropped or fixed", () => {
  const p = sanitizePages(
    {
      home: [{ id: "a", type: "hero", title: "x".repeat(500), image: "javascript:alert(1)" }, { type: "script" }, { id: "a", type: "spacer" }],
      custom: [
        { id: "p1", title: "À propos", handle: "", sections: [{ id: "t", type: "imageText", buttonHref: "javascript:x" }] },
        { id: "p2", title: "About", handle: "a-propos" },
      ],
    },
    [],
  );
  assert.equal(p.home.length, 1);
  const hero = p.home[0];
  assert.ok(hero.type === "hero" && hero.title.length === 120 && hero.image === "");
  assert.deepEqual(p.custom.map((c) => c.handle), ["a-propos", "a-propos-2"]);
  const it = p.custom[0].sections[0];
  assert.ok(it.type === "imageText" && it.buttonHref === "");
  assert.equal(sanitizeSection({ type: "products", limit: 999, columns: 5 })?.type, "products");
  const prod = sanitizeSection({ type: "products", limit: 999, columns: 5 });
  assert.ok(prod?.type === "products" && prod.limit === 48 && prod.columns === 0);
});

test("navigation targets: only known kinds, links built for the store", () => {
  assert.equal(navTarget("page:about-us"), "page:about-us");
  assert.equal(navTarget("url:javascript:alert(1)"), "");
  assert.equal(navTarget("policy:privacy"), "policy:privacy");
  assert.equal(navTarget("policy:nope"), "");
  assert.equal(navHref("page:about-us", "/store/shop"), "/store/shop/pages/about-us");
  assert.equal(navHref("home", ""), "/");
  assert.equal(navHref("products", ""), "/#products");
  assert.equal(navHref("url:https://x.dz", ""), "https://x.dz");
});

test("the global parts are normalized", () => {
  const r = globalSchema.parse({
    primaryColor: "#2563EB",
    announcementEnabled: true,
    announcementText: "Livraison gratuite",
    links: [{ label: "Accueil", target: "home" }, { label: "", target: "home" }, { label: "Bad", target: "url:http://x" }],
    facebook: "facebook.com/myshop",
    whatsapp: "+213 555 12 34 56",
  });
  assert.equal(r.primaryColor, "#2563eb");
  assert.equal(r.logoUrl, null);
  assert.equal(r.design.announcement.enabled, true);
  assert.equal(r.design.navigation.links.length, 1);
  assert.equal(r.design.socials.facebook, "https://facebook.com/myshop");
  assert.equal(r.design.socials.whatsapp, "0555123456");
});

test("bad color, wrong social site, empty announcement are refused", () => {
  const r = globalSchema.safeParse({ primaryColor: "red", instagram: "https://evil.com/x", announcementEnabled: true, logoUrl: "javascript:alert(1)" });
  assert.ok(!r.success);
  const e = fieldErrorsFrom(r.error);
  assert.equal(e.primaryColor, "color");
  assert.equal(e.instagram, "socialLink");
  assert.equal(e.logoUrl, "invalid");
  const empty = globalSchema.safeParse({ primaryColor: "#112233", announcementEnabled: true });
  assert.ok(!empty.success && fieldErrorsFrom(empty.error).announcementText === "required");
});
