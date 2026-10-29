// Pure: the inventory lines of a shop (unit-tested)
type Product = { id: string; name: string; sku: string | null; stock: number; costPrice: number | null; price: number; trackStock: boolean; images: string[]; status: string };
type Variant = { id: string; productId: string; title: string; sku: string | null; stock: number; price: number | null };
type Held = { productId: string | null; variantId: string | null; n: number };

export type StockState = "out" | "low" | "ok";
export type StockRow = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variant: string | null;
  sku: string | null;
  image: string | null;
  stock: number;
  held: number;
  costPrice: number | null;
  // stock × cost price (null when the product has no cost price)
  value: number | null;
  state: StockState;
};

export const stockState = (stock: number, lowStock: number): StockState => (stock <= 0 ? "out" : stock <= lowStock ? "low" : "ok");

export function stockRows(products: Product[], variants: Variant[], held: Held[], lowStock: number): StockRow[] {
  const heldOf = (productId: string, variantId: string | null) => held.filter((h) => h.productId === productId && (h.variantId ?? null) === variantId).reduce((s, h) => s + h.n, 0);
  const rows: StockRow[] = [];
  for (const p of products) {
    if (!p.trackStock) continue;
    const own = variants.filter((v) => v.productId === p.id);
    const lines = own.length ? own.map((v) => ({ variantId: v.id as string | null, variant: v.title as string | null, sku: v.sku ?? p.sku, stock: v.stock })) : [{ variantId: null, variant: null, sku: p.sku, stock: p.stock }];
    for (const l of lines) {
      rows.push({
        key: l.variantId ?? p.id,
        productId: p.id,
        variantId: l.variantId,
        name: p.name,
        variant: l.variant,
        sku: l.sku,
        image: p.images[0] ?? null,
        stock: l.stock,
        held: heldOf(p.id, l.variantId),
        costPrice: p.costPrice,
        value: p.costPrice == null ? null : Math.max(0, l.stock) * p.costPrice,
        state: stockState(l.stock, lowStock),
      });
    }
  }
  // The lines that need attention first
  const order = { out: 0, low: 1, ok: 2 };
  return rows.sort((a, b) => order[a.state] - order[b.state] || a.stock - b.stock || a.name.localeCompare(b.name));
}

export function stockTotals(rows: StockRow[]) {
  return {
    lines: rows.length,
    units: rows.reduce((s, r) => s + Math.max(0, r.stock), 0),
    held: rows.reduce((s, r) => s + r.held, 0),
    value: rows.reduce((s, r) => s + (r.value ?? 0), 0),
    valueMissing: rows.some((r) => r.value == null),
    low: rows.filter((r) => r.state === "low").length,
    out: rows.filter((r) => r.state === "out").length,
  };
}
