// Client-side ad tracking: sends the same event to Meta Pixel, TikTok Pixel and
// GTM's dataLayer, whichever the shop has configured (missing ones are no-ops).

type Win = Window & {
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (...args: unknown[]) => void; page: () => void };
  dataLayer?: unknown[];
};

export type TrackItem = { id: string; name: string; price: number; quantity?: number };

const w = () => (typeof window === "undefined" ? null : (window as Win));

export function trackPageView() {
  const win = w();
  win?.fbq?.("track", "PageView");
  win?.ttq?.page();
}

export function trackViewContent(item: TrackItem, currency: string) {
  const win = w();
  win?.fbq?.("track", "ViewContent", { content_ids: [item.id], content_name: item.name, content_type: "product", value: item.price, currency });
  win?.ttq?.track("ViewContent", { content_id: item.id, content_name: item.name, content_type: "product", value: item.price, currency });
  win?.dataLayer?.push({ event: "view_item", ecommerce: { currency, value: item.price, items: [{ item_id: item.id, item_name: item.name, price: item.price }] } });
}

export function trackInitiateCheckout(item: TrackItem, currency: string) {
  const win = w();
  win?.fbq?.("track", "InitiateCheckout", { content_ids: [item.id], content_type: "product", value: item.price, currency });
  win?.ttq?.track("InitiateCheckout", { content_id: item.id, content_type: "product", value: item.price, currency });
  win?.dataLayer?.push({ event: "begin_checkout", ecommerce: { currency, value: item.price, items: [{ item_id: item.id, item_name: item.name, price: item.price }] } });
}

// orderId is used as the event id so the platforms can de-duplicate,
// and remembered so a page refresh does not count the purchase twice.
export function trackPurchase(orderId: string, value: number, currency: string, items: TrackItem[]) {
  const win = w();
  if (!win) return;
  const key = `sc_purchase_${orderId}`;
  try {
    if (win.sessionStorage.getItem(key)) return;
    win.sessionStorage.setItem(key, "1");
  } catch {
    // storage unavailable: still track once per page load
  }
  const ids = items.map((i) => i.id);
  win.fbq?.("track", "Purchase", { content_ids: ids, content_type: "product", value, currency, num_items: items.length }, { eventID: orderId });
  win.ttq?.track("CompletePayment", { contents: items.map((i) => ({ content_id: i.id, content_name: i.name, quantity: i.quantity ?? 1, price: i.price })), value, currency }, { event_id: orderId });
  win.dataLayer?.push({
    event: "purchase",
    ecommerce: { transaction_id: orderId, currency, value, items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity ?? 1 })) },
  });
}
