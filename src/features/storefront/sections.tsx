// A store page drawn from its sections (Store Design builder, src/features/design/builder.ts). Plain components shared by
// the real store (home, custom pages) and the builder's preview, which passes `editing` (empty sections show a hint and a
// click selects them). Colors only from the s-* tokens.
import Link from "next/link";
import { ChevronDown, ImageOff } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import type { Theme } from "@/features/themes/themes";
import type { StoreSection } from "@/features/design/builder";
import { textIn } from "@/features/collections/types";
import type { CollectionTexts } from "@/server/db/schema";
import { youtubeEmbed } from "@/features/landing/types";
import { Hero, OrderSteps, ProductGrid, TrustBadges, type BadgeItem, type GridProduct } from "./blocks";

export type SectionData = {
  products: GridProduct[];
  collections: { id: string; handle: string; titles: CollectionTexts; image: string | null }[];
  badges: BadgeItem[];
  base: string;
  currency: string;
  locale: Locale;
  t: StoreText;
  layout: Theme["layout"];
};

type Editing = { selected: string | null; onSelect: (id: string) => void; emptyText: string };

const spacer = { sm: "h-4", md: "h-10", lg: "h-20" } as const;

function Placeholder({ text }: { text: string }) {
  return <p className="rounded-[var(--s-radius)] border-2 border-dashed border-s-edge p-6 text-center text-sm text-s-muted">{text}</p>;
}

function SectionView({ s, data, editing, first }: { s: StoreSection; data: SectionData; editing?: Editing; first: boolean }) {
  const { t } = data;
  switch (s.type) {
    case "hero":
      if (!s.title && !s.image && !s.subtitle) return editing ? <Placeholder text={editing.emptyText} /> : null;
      return <Hero hero={{ enabled: true, image: s.image, title: s.title, subtitle: s.subtitle, buttonText: s.buttonText }} variant={s.variant || data.layout.hero} t={t} />;
    case "badges":
      return <TrustBadges t={t} items={data.badges} />;
    case "steps":
      return data.products.length > 0 || editing ? <OrderSteps t={t} /> : null;
    case "collections":
      if (!data.collections.length) return editing ? <Placeholder text={editing.emptyText} /> : null;
      return (
        <section className="space-y-3">
          {s.title && <h2 className="text-xl font-extrabold tracking-tight">{s.title}</h2>}
          <nav className="flex gap-3 overflow-x-auto pb-1" data-testid="store-collections">
            {data.collections.map((c) => (
              <Link key={c.id} href={`${data.base}/collections/${c.handle}`} className="flex shrink-0 items-center gap-2 rounded-full border border-s-edge bg-s-surface py-1.5 ps-1.5 pe-4 text-sm font-semibold shadow-[var(--s-shadow)] hover:border-brand">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="size-8 rounded-full object-cover" />
                ) : (
                  <span className="size-2" />
                )}
                {textIn(c.titles, data.locale)}
              </Link>
            ))}
          </nav>
        </section>
      );
    case "products": {
      let list = s.collectionId ? data.products.filter((p) => p.collectionIds?.includes(s.collectionId)) : data.products;
      if (s.limit) list = list.slice(0, s.limit);
      return <ProductGrid title={s.title} products={list} base={data.base} currency={data.currency} t={t} layout={{ ...data.layout, columns: s.columns || data.layout.columns }} anchor={first} />;
    }
    case "text":
      if (!s.title && !s.body) return editing ? <Placeholder text={editing.emptyText} /> : null;
      return (
        <section className={`space-y-3 ${s.align === "center" ? "mx-auto max-w-3xl text-center" : ""}`} data-section="text">
          {s.title && <h2 className="text-2xl font-extrabold tracking-tight @min-[40rem]:text-3xl">{s.title}</h2>}
          {s.body && <p className="leading-relaxed whitespace-pre-line text-s-muted">{s.body}</p>}
        </section>
      );
    case "imageText":
      return (
        <section className="grid items-center gap-6 @min-[48rem]:grid-cols-2" data-section="imageText">
          <div className={s.side === "end" ? "@min-[48rem]:order-2" : ""}>
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" loading="lazy" className="h-auto w-full rounded-[var(--s-radius)] object-cover shadow-[var(--s-shadow)]" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center rounded-[var(--s-radius)] bg-s-surface text-s-muted">
                <ImageOff size={28} />
              </div>
            )}
          </div>
          <div className="space-y-4">
            {s.title && <h2 className="text-2xl font-extrabold tracking-tight @min-[40rem]:text-3xl">{s.title}</h2>}
            {s.body && <p className="leading-relaxed whitespace-pre-line text-s-muted">{s.body}</p>}
            {s.buttonText && (
              <a href={s.buttonHref || "#products"} className="inline-flex rounded-[var(--s-radius-btn)] bg-brand px-6 py-3 font-bold text-brand-fg">
                {s.buttonText}
              </a>
            )}
          </div>
        </section>
      );
    case "faq": {
      const items = s.items.filter((i) => i.q);
      if (!items.length) return editing ? <Placeholder text={editing.emptyText} /> : null;
      return (
        <section className="mx-auto max-w-3xl space-y-4" data-section="faq">
          {s.title && <h2 className="text-center text-2xl font-extrabold tracking-tight">{s.title}</h2>}
          <div className="divide-y divide-s-edge overflow-hidden rounded-[var(--s-radius)] border border-s-edge bg-s-surface">
            {items.map((i, n) => (
              <details key={n} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  {i.q} <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" />
                </summary>
                {i.a && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-s-muted">{i.a}</p>}
              </details>
            ))}
          </div>
        </section>
      );
    }
    case "video": {
      const src = youtubeEmbed(s.url);
      if (!src) return editing ? <Placeholder text={editing.emptyText} /> : null;
      return (
        <section className="space-y-3" data-section="video">
          {s.title && <h2 className="text-center text-2xl font-extrabold tracking-tight">{s.title}</h2>}
          <div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-[var(--s-radius)]">
            <iframe src={src} title={s.title || "video"} className={`size-full ${editing ? "pointer-events-none" : ""}`} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
        </section>
      );
    }
    case "spacer":
      return <div className={spacer[s.size]} aria-hidden />;
  }
}

export function StoreSections({ sections, data, editing }: { sections: StoreSection[]; data: SectionData; editing?: Editing }) {
  const shown = sections.filter((s) => !s.hidden);
  const firstProducts = shown.find((s) => s.type === "products")?.id;
  return (
    <div className="space-y-10" data-testid="store-sections">
      {shown.map((s) => {
        const view = <SectionView s={s} data={data} editing={editing} first={s.id === firstProducts} />;
        if (!editing) return <div key={s.id}>{view}</div>;
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => editing.onSelect(s.id)}
            onKeyDown={(e) => e.key === "Enter" && editing.onSelect(s.id)}
            className={`relative cursor-pointer rounded-[var(--s-radius)] outline-offset-4 ${editing.selected === s.id ? "outline-2 outline-solid outline-[#4f3bd6]" : "hover:outline-2 hover:outline-dashed hover:outline-[#4f3bd6]/50"}`}
            data-preview-section={s.id}
          >
            <div className="pointer-events-none">{view}</div>
          </div>
        );
      })}
    </div>
  );
}
