"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Save } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import type { ActionState } from "@/lib/action";
import type { ProductOption, QuantityOffer } from "@/server/db/schema";
import { Alert, Button } from "@/ui";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import { StoreFrame } from "@/features/storefront/blocks";
import type { Theme } from "@/features/themes/themes";
import type { RateMap } from "@/features/checkout/pricing";
import { defaultForm, type FormSettings } from "@/features/landing/types";
import { FormBuilder, type FormBuilderText } from "./FormBuilder";

type Preview = {
  storeText: StoreText;
  locale: Locale;
  currency: string;
  color: string;
  theme: Theme;
  product: { name: string; price: number; options: ProductOption[]; offers: QuantityOffer[] };
  rates: RateMap;
  wilayas: { code: number; name: string }[];
  phone: string;
};

// The Order form section: the builder beside a live preview of the form as customers see it (the store's language and theme).
export function OrderFormEditor({ lang, initial, preview, action, t }: { lang: string; initial: FormSettings; preview: Preview; action: (form: FormSettings) => Promise<ActionState>; t: FormBuilderText & Pick<Dictionary, "errors" | "common"> }) {
  const f = t.orderForm;
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = t.errors as Record<string, string>;
  const st = preview.storeText;

  const save = () =>
    startTransition(async () => {
      const r = await action(form);
      setResult(r);
      if (r.ok) setDirty(false);
    });

  // Variants of the sample product, so options show in the preview
  const combos = preview.product.options.reduce<Record<string, string>[]>((all, o) => all.flatMap((v) => o.values.map((value) => ({ ...v, [o.name]: value }))), [{}]);
  const variants = preview.product.options.length ? combos.map((values, i) => ({ id: String(i), values, price: null, stock: 1 })) : [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" data-lang={lang}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-3">
          <p className="me-auto text-sm text-muted">{f.storeHint}</p>
          {dirty && <span className="text-xs font-semibold text-warning">{f.unsaved}</span>}
          <Button
            variant="ghost"
            onClick={() => {
              if (!confirm(f.resetConfirm)) return;
              setForm(defaultForm);
              setDirty(true);
            }}
          >
            <RotateCcw size={15} /> {f.reset}
          </Button>
          <Button onClick={save} disabled={pending || !dirty} data-testid="save-order-form">
            <Save size={15} /> {pending ? t.common.loading : t.common.save}
          </Button>
        </div>
        {result && !pending && (result.ok ? !dirty && <Alert variant="success">{f.saved}</Alert> : <Alert>{errors[result.error ?? "unexpected"] ?? errors.unexpected}</Alert>)}
        <FormBuilder
          form={form}
          set={(patch) => {
            setForm((x) => ({ ...x, ...patch }));
            setDirty(true);
          }}
          t={t}
          defaults={{ title: st.form.title, subtitle: st.form.subtitle, button: st.form.submit }}
        />
      </div>

      <div className="lg:sticky lg:top-4">
        <p className="mb-2 text-xs font-semibold text-muted">
          {f.preview} · {f.appearances[form.appearance]}
        </p>
        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-line shadow-sm" data-testid="order-form-preview">
          <StoreFrame locale={preview.locale} color={preview.color} theme={preview.theme} className="p-3">
            <CheckoutForm
              t={st}
              currency={preview.currency}
              product={{ price: preview.product.price, trackStock: false, stock: 0, options: preview.product.options, offers: preview.product.offers }}
              variants={variants}
              rates={preview.rates}
              wilayas={preview.wilayas}
              action={async () => ({ ok: false })}
              saveLead={async () => {}}
              settings={{ ...form, appearance: "direct" }}
              whatsapp={{ phone: preview.phone, product: preview.product.name }}
              embedded
            />
          </StoreFrame>
        </div>
      </div>
    </div>
  );
}
