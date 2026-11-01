import { test } from "node:test";
import assert from "node:assert/strict";
import { liveVersions, readPublished, sanitizeSections, sanitizeVariants, versionSections } from "../../src/features/landing/types";

test("landing: pages made before the Zimam builder become its components", () => {
  const out = sanitizeSections([
    { id: "m", type: "marquee", items: ["Paiement à la livraison", "58 wilayas"] },
    { id: "p", type: "poster", image: "/uploads/s1/a.webp", headline: "Montre", bullets: ["Étanche"], scene: "desk" },
    { id: "h", type: "hero", title: "Titre", subtitle: "Sous-titre", image: "/uploads/s1/b.webp" },
    { id: "b", type: "badges", items: ["COD", "Livraison"] },
    { id: "st", type: "steps", items: ["Commandez", "On appelle"] },
    { id: "g", type: "gallery", images: ["/uploads/s1/c.webp", "/uploads/s1/d.webp"] },
    { id: "c", type: "cta", title: "Commandez" },
    { id: "sp", type: "spacer", size: "lg", line: true },
  ]);
  assert.deepEqual(
    out.map((s) => s.type),
    ["announcement", "image", "image", "text", "badges", "bullets", "image", "image", "spacer"],
  );
  assert.equal((out[0] as { text: string; scrolling: boolean }).scrolling, true);
  const poster = out[1] as { url: string; poster?: { headline: string } };
  assert.equal(poster.url, "/uploads/s1/a.webp");
  assert.equal(poster.poster?.headline, "Montre");
  assert.deepEqual((out[4] as { items: { icon: string; text: string }[] }).items[0], { icon: "check", text: "COD" });
  assert.equal((out[5] as { style: string }).style, "number");
  assert.equal((out[8] as { size: number }).size, 80);
  assert.equal(new Set(out.map((s) => s.id)).size, out.length, "unique ids");
});

test("landing: versions B and C, paused ones not shown to visitors", () => {
  const variants = sanitizeVariants([
    { key: "B", sections: [{ type: "text", body: "B" }], paused: false },
    { key: "B", sections: [] },
    { key: "C", sections: [{ type: "text", body: "C" }] },
    { key: "Z", sections: [] },
  ]);
  assert.deepEqual(
    variants.map((v) => [v.key, v.paused]),
    [
      ["B", false],
      ["C", true],
    ],
  );
  const published = readPublished({ sections: [{ type: "text", body: "A" }], variants })!;
  assert.deepEqual(liveVersions(published), ["A", "B"]);
  assert.equal((versionSections(published, "B")[0] as { body: string }).body, "B");
  // An unknown version falls back to A
  assert.equal((versionSections(published, "C")[0] as { body: string }).body, "C");
  assert.equal(readPublished(null), null);
});
