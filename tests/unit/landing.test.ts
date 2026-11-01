import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultForm, resolveForm, sanitizeSections, youtubeEmbed } from "../../src/features/landing/types";

test("components from the builder or the AI are cleaned", () => {
  const out = sanitizeSections([
    { type: "image", url: "/uploads/abc-1/pic.webp", fit: "cover", margin: 999, radius: "12" },
    { type: "image", url: "http://insecure.com/x.jpg" },
    { type: "script", body: "<script>" },
    { type: "faq", items: [{ q: "Paiement ?", a: "À la livraison" }, { q: "", a: "" }] },
    { type: "reviews", items: [{ name: "Karim", text: "Top", rating: 9 }] },
    { type: "video", url: "https://youtu.be/dQw4w9WgXcQ" },
    { type: "video", url: "https://evil.com/v" },
    { type: "form" },
    { type: "form" },
    { type: "sticky", label: "Commander" },
    { type: "sticky" },
    { type: "countdown", endsAt: "not a date" },
  ]);
  assert.deepEqual(
    out.map((s) => s.type),
    ["image", "image", "faq", "reviews", "video", "video", "form", "sticky"],
  );
  const img = out[0] as { url: string; fit: string; margin: number; radius: number };
  assert.deepEqual([img.url, img.fit, img.margin, img.radius], ["/uploads/abc-1/pic.webp", "cover", 120, 12]);
  // An unsafe image becomes an empty placeholder, an unknown video link an empty video
  assert.equal((out[1] as { url: string }).url, "");
  assert.equal((out[5] as { url: string }).url, "");
  assert.equal((out[2] as { items: unknown[] }).items.length, 1);
  assert.equal((out[3] as { items: { rating: number }[] }).items[0].rating, 5);
  assert.ok(out.every((s) => typeof s.id === "string" && s.id.length > 0));
  assert.deepEqual(sanitizeSections("nope"), []);
});

test("YouTube links become privacy-friendly embeds", () => {
  assert.equal(youtubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(youtubeEmbed("https://youtube.com/shorts/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(youtubeEmbed("https://vimeo.com/123"), null);
});

test("form settings keep only allowed choices", () => {
  assert.deepEqual(resolveForm(null), defaultForm);
  const f = resolveForm({
    layout: "weird",
    address: "required",
    delivery: "office",
    custom: [
      { label: "Taille au pied", type: "text", required: true },
      { label: "Couleur", type: "select", options: ["Noir", "Noir", "Blanc"] },
      { label: "Un seul choix", type: "select", options: ["A"] },
      { label: "", type: "text" },
      { label: "4", type: "text" },
      { label: "5", type: "text" },
      { label: "6", type: "text" },
    ],
  });
  assert.equal(f.layout, "compact");
  assert.equal(f.address, "required");
  assert.equal(f.delivery, "office");
  // The two invalid ones are dropped (up to MAX_CUSTOM_FIELDS = 8 are kept)
  assert.equal(f.custom.length, 5);
  assert.deepEqual(f.custom[1].options, ["Noir", "Blanc"]);
  assert.equal(f.custom[0].required, true);
});
