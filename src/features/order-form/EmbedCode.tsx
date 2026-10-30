"use client";

import { useState } from "react";
import { Code, Copy } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Button, Card, Field, Select } from "@/ui";

type Source = { id: string; name: string; url: string };

// The code that puts an order form on any website (WordPress, a sales page…): a product's form or a landing page's form.
// The frame grows with the form (HeightReporter inside sends its height).
export const embedSnippet = (frameId: string, url: string, title: string) =>
  `<iframe id="scaleitto-${frameId}" src="${url}" style="width:100%;border:0;min-height:760px" loading="lazy" title="${title.replace(/"/g, "")}"></iframe>\n<script>window.addEventListener("message",function(e){if(e.data&&e.data.type==="scaleitto:height"&&e.data.id==="${frameId}"){document.getElementById("scaleitto-${frameId}").style.height=e.data.height+"px"}});</script>`;

export function EmbedCode({ products, pages, t }: { products: Source[]; pages: Source[]; t: Dictionary["orderForm"]["embed"] }) {
  const all = [...products, ...pages];
  const [id, setId] = useState(all[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const source = all.find((s) => s.id === id);
  if (!all.length) return null;
  const code = source ? embedSnippet(source.id, source.url, source.name) : "";
  return (
    <Card className="space-y-3" data-testid="embed-card">
      <h2 className="flex items-center gap-2 font-semibold">
        <Code size={17} className="text-accent" /> {t.title}
      </h2>
      <p className="text-xs text-muted">{t.hint}</p>
      <Field label={t.source}>
        <Select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setCopied(false);
          }}
          data-testid="embed-source"
        >
          {products.length > 0 && (
            <optgroup label={t.products}>
              {products.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
          {pages.length > 0 && (
            <optgroup label={t.pages}>
              {pages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </Field>
      <textarea readOnly dir="ltr" rows={5} value={code} className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs text-muted" data-testid="embed-code" />
      <Button
        variant="secondary"
        onClick={() => {
          navigator.clipboard?.writeText(code).catch(() => {});
          setCopied(true);
        }}
      >
        <Copy size={15} /> {copied ? t.copied : t.copy}
      </Button>
    </Card>
  );
}
