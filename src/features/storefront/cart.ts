"use client";

// Apps → Shopping cart: the buyer's cart lives in this browser (one per shop). Prices are never stored here: the server
// prices every line again when the cart is shown and when it is ordered.
export type CartItem = { productId: string; variantId: string | null; quantity: number };
const key = (shopId: string) => `sc_cart_${shopId}`;
const EVENT = "sc-cart";

export function readCart(shopId: string): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(shopId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.productId === "string" && Number.isInteger(x.quantity) && x.quantity > 0).slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function writeCart(shopId: string, items: CartItem[]) {
  try {
    localStorage.setItem(key(shopId), JSON.stringify(items));
  } catch {
    // storage blocked: the cart lasts as long as the page
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(shopId: string, item: CartItem) {
  const items = readCart(shopId);
  const same = items.find((x) => x.productId === item.productId && x.variantId === item.variantId);
  if (same) same.quantity += item.quantity;
  else items.push(item);
  writeCart(shopId, items);
}

export const cartCount = (shopId: string) => readCart(shopId).reduce((n, x) => n + x.quantity, 0);
export const onCartChange = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
};
