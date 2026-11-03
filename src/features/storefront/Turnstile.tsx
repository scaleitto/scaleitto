"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

export type StoreCaptcha = { siteKey: string; mode: "always" | "risky" } | null;

type TurnstileApi = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Cloudflare Turnstile inside the order form (Apps → Fake OrderGuard → Checkout captcha). Most buyers never see a
// challenge; the answer goes with the form as "cf-turnstile-response" and is checked on the server.
export function TurnstileBox({ siteKey, lang }: { siteKey: string; lang: string }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  useEffect(() => {
    let stop = false;
    const draw = () => {
      if (stop || id.current || !box.current) return;
      if (!window.turnstile) return void setTimeout(draw, 200);
      id.current = window.turnstile.render(box.current, { sitekey: siteKey, language: lang, "response-field-name": "cf-turnstile-response" });
    };
    draw();
    return () => {
      stop = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [siteKey, lang]);
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={box} className="flex justify-center" data-testid="turnstile" />
    </>
  );
}
