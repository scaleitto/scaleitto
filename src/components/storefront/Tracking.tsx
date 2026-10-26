"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { TrackingIds } from "@/lib/tracking-ids";
import { trackPageView, trackPurchase, trackViewContent, type TrackItem } from "@/lib/track";

// Loads the shop's pixels. IDs are validated on the server (safeTrackingIds) before reaching here.
export function TrackingScripts({ ids }: { ids: TrackingIds }) {
  const pathname = usePathname();
  const first = useRef(true);

  // Base codes send the first PageView; later client-side navigations are sent here.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    trackPageView();
  }, [pathname]);

  return (
    <>
      {ids.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {ids.tiktokPixelId && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${ids.tiktokPixelId}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
      {ids.gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${ids.gtmId}');`}
        </Script>
      )}
    </>
  );
}

export function TrackViewContent({ item, currency }: { item: TrackItem; currency: string }) {
  useEffect(() => {
    // Give the pixel scripts a moment to define their queues.
    const t = setTimeout(() => trackViewContent(item, currency), 300);
    return () => clearTimeout(t);
  }, [item, currency]);
  return null;
}

export function TrackPurchase({ orderId, value, currency, items }: { orderId: string; value: number; currency: string; items: TrackItem[] }) {
  useEffect(() => {
    const t = setTimeout(() => trackPurchase(orderId, value, currency, items), 300);
    return () => clearTimeout(t);
  }, [orderId, value, currency, items]);
  return null;
}
