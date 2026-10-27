import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShopify, parseYoucan } from "../../src/features/apps/catalog";

test("Shopify products: options, variants, prices, images, no 'Default Title'", () => {
  const [robe, cap] = parseShopify(
    {
      products: [
        {
          id: 1,
          title: "Robe",
          body_html: "<p>Légère</p><ul><li>Coton</li></ul>",
          options: [{ name: "Taille", values: ["S", "M"] }],
          variants: [
            { option1: "S", price: "2500.00", compare_at_price: "3200.00", sku: "R-S" },
            { option1: "M", price: "2700.00", sku: "R-M" },
          ],
          images: [{ src: "https://cdn.x/a.jpg" }, { src: "javascript:alert(1)" }],
        },
        { id: 2, title: "Casquette", options: [{ name: "Title", values: ["Default Title"] }], variants: [{ option1: "Default Title", price: "900" }], images: [] },
        { id: 3, title: "Sans prix", variants: [] },
      ],
    },
    "store.com",
  );
  assert.equal(robe.ref, "shopify:store.com:1");
  assert.equal(robe.price, 2500);
  assert.equal(robe.compareAtPrice, 3200);
  assert.deepEqual(robe.options, [{ name: "Taille", values: ["S", "M"] }]);
  assert.deepEqual(robe.variants.map((v) => [v.values.Taille, v.price, v.sku]), [["S", null, "R-S"], ["M", 2700, "R-M"]]);
  assert.deepEqual(robe.images, ["https://cdn.x/a.jpg"]);
  assert.ok(robe.description.includes("Légère") && robe.description.includes("• Coton"));
  assert.deepEqual([cap.options, cap.variants, cap.price], [[], [], 900]);
});

test("too many combinations: imported without options", () => {
  const values = Array.from({ length: 11 }, (_, i) => `v${i}`);
  const [p] = parseShopify({ products: [{ id: 9, title: "Big", options: [{ name: "A", values }, { name: "B", values }], variants: [{ option1: "v0", option2: "v0", price: "100" }] }] }, "s");
  assert.deepEqual([p.options, p.variants, p.price], [[], [], 100]);
});

test("YouCan products in several shapes", () => {
  const [a, b] = parseYoucan({
    data: [
      { id: "x1", name: "Montre", price: 4200, compare_at_price: 5000, images: [{ url: "https://cdn.y/1.jpg" }, { variations: { original: "https://cdn.y/2.jpg" } }], variants: { data: [{ variations: { default: "default" }, price: 4200 }] } },
      { id: "x2", name: "T-shirt", price: "1500.00", images: ["https://cdn.y/3.jpg"], variants: [{ variations: { Size: "L" }, price: "1500.00" }, { variations: { Size: "XL" }, price: "1700.00" }] },
    ],
  });
  assert.deepEqual([a.ref, a.price, a.compareAtPrice, a.options, a.images.length], ["youcan:x1", 4200, 5000, [], 2]);
  assert.deepEqual(b.options, [{ name: "Size", values: ["L", "XL"] }]);
  assert.deepEqual(b.variants.map((v) => v.price), [null, 1700]);
  assert.deepEqual(parseYoucan(null), []);
});
