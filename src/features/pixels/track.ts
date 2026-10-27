"use client";
// Browser ad tracking: each event goes only to the pixels of the current page
// (Meta trackSingle, TikTok instance, GA4 send_to), so product-specific pixels stay clean.
import type { ClientPixel } from "./ids";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };
type Ttq = unknown[] & { load?: (id: string) => void; instance?: (id: string) => { page: () => void; track: (...a: unknown[]) => void } };
type Win = Window & { fbq?: Fbq; _fbq?: Fbq; ttq?: Ttq; TiktokAnalyticsObject?: string; dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; __scPixels?: Set<string> };

export type TrackItem = { id: string; name: string; price: number; quantity: number };
export const CURRENCY = "DZD";

function addScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

// The official loader snippets, written out (IDs were validated on the server).
function boot(win: Win, p: ClientPixel) {
  win.__scPixels ??= new Set();
  const key = `${p.platform}:${p.id}`;
  if (win.__scPixels.has(key)) return;
  win.__scPixels.add(key);
  if (p.platform === "meta") {
    if (!win.fbq) {
      const n: Fbq = function (...args: unknown[]) {
        if (n.callMethod) n.callMethod(...args);
        else n.queue!.push(args);
      };
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      win.fbq = win._fbq = n;
      addScript("https://connect.facebook.net/en_US/fbevents.js");
    }
    win.fbq("init", p.id);
  } else if (p.platform === "tiktok") {
    if (!win.ttq) {
      win.TiktokAnalyticsObject = "ttq";
      const ttq = [] as unknown as Ttq & Record<string, unknown> & { _i?: Record<string, unknown[] & Record<string, unknown>>; _t?: Record<string, number>; _o?: Record<string, unknown> };
      const methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
      const defer = (target: Record<string, unknown> & unknown[], method: string) => {
        target[method] = (...args: unknown[]) => target.push([method, ...args]);
      };
      for (const m of methods) defer(ttq, m);
      ttq.instance = (id: string) => {
        const inst = (ttq._i![id] ?? []) as unknown[] & Record<string, unknown>;
        for (const m of methods) defer(inst, m);
        return inst as never;
      };
      ttq.load = (id: string) => {
        const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i ?? {};
        ttq._i[id] = [] as unknown as unknown[] & Record<string, unknown>;
        ttq._i[id]._u = url;
        ttq._t = { ...ttq._t, [id]: Date.now() };
        ttq._o = { ...ttq._o, [id]: {} };
        addScript(`${url}?sdkid=${id}&lib=ttq`);
      };
      win.ttq = ttq;
    }
    win.ttq.load!(p.id);
  } else if (p.platform === "ga4") {
    win.dataLayer ??= [];
    if (!win.gtag) {
      win.gtag = function (...args: unknown[]) {
        // gtag must push the arguments object itself
        // eslint-disable-next-line prefer-rest-params
        win.dataLayer!.push(arguments);
        void args;
      };
      win.gtag("js", new Date());
      addScript(`https://www.googletagmanager.com/gtag/js?id=${p.id}`);
    }
    win.gtag("config", p.id, { send_page_view: false });
  } else {
    win.dataLayer ??= [];
    win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    addScript(`https://www.googletagmanager.com/gtm.js?id=${p.id}`);
  }
}

const win = () => (typeof window === "undefined" ? null : (window as Win));

export function loadPixels(pixels: ClientPixel[]) {
  const w = win();
  if (!w) return;
  for (const p of pixels) boot(w, p);
  rememberClickIds();
}

// Keeps ad-click IDs from the URL in first-party cookies, so the server can send them with the order.
function rememberClickIds() {
  const params = new URLSearchParams(location.search);
  const set = (name: string, value: string) => (document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${90 * 86400}; samesite=lax`);
  const ttclid = params.get("ttclid");
  if (ttclid) set("sc_ttclid", ttclid);
  const fbclid = params.get("fbclid");
  if (fbclid && !document.cookie.includes("_fbc=")) set("_fbc", `fb.1.${Date.now()}.${fbclid}`);
}

type Event = "page" | "view" | "checkout" | "purchase" | "lead";
const names: Record<Event, { meta: string; tiktok: string; google: string }> = {
  page: { meta: "PageView", tiktok: "", google: "page_view" },
  view: { meta: "ViewContent", tiktok: "ViewContent", google: "view_item" },
  checkout: { meta: "InitiateCheckout", tiktok: "InitiateCheckout", google: "begin_checkout" },
  purchase: { meta: "Purchase", tiktok: "CompletePayment", google: "purchase" },
  lead: { meta: "Lead", tiktok: "PlaceAnOrder", google: "generate_lead" },
};

function send(pixels: ClientPixel[], event: Event, items: TrackItem[] = [], orderId?: string, total?: number) {
  const w = win();
  if (!w) return;
  const value = total ?? items.reduce((s, i) => s + i.price * i.quantity, 0);
  const n = names[event];
  const eventId = orderId ? (event === "lead" ? `lead-${orderId}` : orderId) : undefined;
  for (const p of pixels) {
    if (p.platform === "meta" && w.fbq) {
      const data = event === "page" ? undefined : { content_ids: items.map((i) => i.id), content_type: "product", contents: items.map((i) => ({ id: i.id, quantity: i.quantity })), value, currency: CURRENCY, ...(orderId ? { order_id: orderId } : {}) };
      w.fbq("trackSingle", p.id, n.meta, data, eventId ? { eventID: eventId } : undefined);
    } else if (p.platform === "tiktok" && w.ttq?.instance) {
      const t = w.ttq.instance(p.id);
      if (event === "page") t.page();
      else t.track(n.tiktok, { contents: items.map((i) => ({ content_id: i.id, content_name: i.name, quantity: i.quantity, price: i.price })), content_type: "product", value, currency: CURRENCY }, eventId ? { event_id: eventId } : undefined);
    } else if (p.platform === "ga4" && w.gtag) {
      w.gtag("event", n.google, {
        send_to: p.id,
        ...(event === "page" ? {} : { currency: CURRENCY, value, items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })) }),
        ...(orderId && event === "purchase" ? { transaction_id: orderId } : {}),
      });
    } else if (p.platform === "gtm" && event !== "page") {
      w.dataLayer?.push({ ecommerce: null });
      w.dataLayer?.push({ event: n.google, ecommerce: { currency: CURRENCY, value, ...(orderId && event === "purchase" ? { transaction_id: orderId } : {}), items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })) } });
    }
  }
}

export const trackPage = (pixels: ClientPixel[]) => send(pixels, "page");
export const trackViewContent = (pixels: ClientPixel[], item: TrackItem) => send(pixels, "view", [item]);
export const trackInitiateCheckout = (pixels: ClientPixel[], item: TrackItem) => send(pixels, "checkout", [item]);

// The order: "purchase" for pixels that count it now, "lead" for those waiting for confirmation/delivery
// (their purchase is sent from the server later). Remembered so a refresh does not count it twice.
export function trackOrder(pixels: ClientPixel[], orderId: string, items: TrackItem[], total: number) {
  const w = win();
  if (!w) return;
  const key = `sc_order_${orderId}`;
  try {
    if (w.sessionStorage.getItem(key)) return;
    w.sessionStorage.setItem(key, "1");
  } catch {
    // storage blocked: still tracked once per page load
  }
  send(pixels.filter((p) => p.purchaseOn === "placed"), "purchase", items, orderId, total);
  send(pixels.filter((p) => p.purchaseOn !== "placed"), "lead", items, orderId, total);
}
