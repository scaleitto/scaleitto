"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { ClientPixel } from "./ids";
import { loadPixels, trackInitiateCheckout, trackOrder, trackPage, trackViewContent, type TrackItem } from "./track";

type Scope = { pixels: ClientPixel[]; item?: TrackItem };
const PixelContext = createContext<Scope>({ pixels: [] });

// Loads the page's pixels and sends its events once: page view, the product viewed, or the order placed.
export function PixelScope({ pixels, item, order, children }: { pixels: ClientPixel[]; item?: TrackItem; order?: { id: string; total: number; items: TrackItem[] }; children?: ReactNode }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !pixels.length) return;
    sent.current = true;
    loadPixels(pixels);
    trackPage(pixels);
    if (item) trackViewContent(pixels, item);
    if (order) trackOrder(pixels, order.id, order.items, order.total);
  }, [pixels, item, order]);
  return <PixelContext.Provider value={{ pixels, item }}>{children}</PixelContext.Provider>;
}

// For the order form: reports "InitiateCheckout" the first time the customer starts filling it.
export function useCheckoutStarted() {
  const { pixels, item } = useContext(PixelContext);
  const sent = useRef(false);
  return () => {
    if (sent.current || !item || !pixels.length) return;
    sent.current = true;
    trackInitiateCheckout(pixels, item);
  };
}
