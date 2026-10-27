import { test } from "node:test";
import assert from "node:assert/strict";
import { designSchema } from "../../src/features/design/validators";
import { defaultDesign, resolveDesign } from "../../src/features/design/types";
import { fieldErrorsFrom } from "../../src/lib/validation";

test("old or partial saved designs get the defaults", () => {
  assert.deepEqual(resolveDesign(null), defaultDesign);
  const d = resolveDesign({ hero: { title: "Hi" }, showBadges: false, unknown: 1 });
  assert.equal(d.hero.title, "Hi");
  assert.equal(d.hero.enabled, false);
  assert.equal(d.showBadges, false);
  assert.equal(d.socials.facebook, "");
});

test("a design form is normalized", () => {
  const r = designSchema.parse({
    primaryColor: "#2563EB",
    announcementEnabled: "on",
    announcementText: "Livraison gratuite",
    heroEnabled: "on",
    heroTitle: "Soldes",
    heroImage: "/uploads/abc/def.webp",
    facebook: "facebook.com/myshop",
    whatsapp: "+213 555 12 34 56",
  });
  assert.equal(r.primaryColor, "#2563eb");
  assert.equal(r.logoUrl, null);
  assert.equal(r.design.announcement.enabled, true);
  assert.equal(r.design.showBadges, false);
  assert.equal(r.design.socials.facebook, "https://facebook.com/myshop");
  assert.equal(r.design.socials.whatsapp, "0555123456");
});

test("bad color, wrong social site, empty enabled sections are refused", () => {
  const r = designSchema.safeParse({ primaryColor: "red", instagram: "https://evil.com/x", announcementEnabled: "on", heroEnabled: "on", heroImage: "javascript:alert(1)" });
  assert.ok(!r.success);
  const e = fieldErrorsFrom(r.error);
  assert.equal(e.primaryColor, "color");
  assert.equal(e.instagram, "socialLink");
  assert.equal(e.announcementText, "required");
  assert.equal(e.heroImage, "invalid");
});
