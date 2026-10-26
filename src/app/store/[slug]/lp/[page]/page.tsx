import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LandingSection } from "@/db/schema";
import { getShopBySlug } from "@/lib/store";
import { getStoreDictionary, type StoreDictionary } from "@/i18n/store";
import { dir, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { formatPrice } from "@/lib/format";
import { ProductCheckout } from "../../ProductCheckout";
import { recordLandingView } from "../../actions";
import { RecordView } from "./RecordView";
import { StickyOrderButton } from "./StickyOrderButton";

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function loadPage(slug: string, pageSlug: string) {
  const shop = await getShopBySlug(slug);
  if (!shop) return null;
  const [row] = await db
    .select({ page: schema.landingPages, product: schema.products })
    .from(schema.landingPages)
    .innerJoin(schema.products, eq(schema.products.id, schema.landingPages.productId))
    .where(
      and(
        eq(schema.landingPages.shopId, shop.id),
        eq(schema.landingPages.slug, safeDecode(pageSlug)),
        eq(schema.landingPages.status, "active"),
        eq(schema.products.status, "active"),
      ),
    );
  return row ? { shop, ...row } : null;
}

export async function generateMetadata({ params }: PageProps<"/store/[slug]/lp/[page]">): Promise<Metadata> {
  const { slug, page } = await params;
  const data = await loadPage(slug, page);
  if (!data) return {};
  const image = data.product.images[0];
  return { title: data.page.title, openGraph: { title: data.page.title, images: image ? [image] : [] } };
}

function Section({ section, s }: { section: LandingSection; s: StoreDictionary }) {
  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-3 text-center">
          {section.badge && <span className="inline-block rounded-full bg-brand px-4 py-1 text-sm font-bold text-white">{section.badge}</span>}
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{section.title}</h1>
          {section.subtitle && <p className="text-lg text-slate-600">{section.subtitle}</p>}
          {section.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.image} alt="" className="mx-auto w-full rounded-2xl" />
          )}
        </div>
      );
    case "badges":
      return (
        <div className="grid grid-cols-2 gap-2">
          {section.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5 text-sm font-semibold">
              <span className="text-brand">✓</span>
              {item}
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <div className="space-y-3">
          {section.title && <h2 className="text-center text-xl font-bold">{section.title}</h2>}
          <ol className="space-y-2">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "cta":
      return (
        <div className="rounded-2xl bg-brand p-6 text-center text-white shadow-lg">
          <h2 className="text-2xl font-extrabold">{section.title}</h2>
          {section.subtitle && <p className="mt-2 opacity-90">{section.subtitle}</p>}
          <a href="#order" className="mt-4 inline-block rounded-xl bg-white px-8 py-3 font-bold text-brand shadow">
            {s.orderNow} · {s.cod}
          </a>
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          {section.title && <h2 className="text-xl font-bold">{section.title}</h2>}
          <p className="whitespace-pre-line leading-relaxed text-slate-700">{section.body}</p>
        </div>
      );
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={section.url} alt="" className="w-full rounded-2xl" />;
    case "features":
      return (
        <div className="space-y-3">
          {section.title && <h2 className="text-center text-xl font-bold">{section.title}</h2>}
          <ul className="space-y-2">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-sm text-white">✓</span>
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "testimonials":
      return (
        <div className="space-y-3">
          {section.title && <h2 className="text-center text-xl font-bold">{section.title}</h2>}
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-4 shadow-sm">
                <div className="text-amber-400">★★★★★</div>
                <p className="mt-2 text-slate-700">{item.text}</p>
                <p className="mt-2 text-sm font-semibold">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-3">
          {section.title && <h2 className="text-center text-xl font-bold">{section.title}</h2>}
          {section.items.map((item, i) => (
            <details key={i} className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-semibold">{item.q}</summary>
              <p className="mt-2 whitespace-pre-line text-slate-700">{item.a}</p>
            </details>
          ))}
        </div>
      );
  }
}

export default async function LandingPage({ params }: PageProps<"/store/[slug]/lp/[page]">) {
  const { slug, page: pageSlug } = await params;
  const data = await loadPage(slug, pageSlug);
  if (!data) notFound();
  const { shop, page, product } = data;
  const locale = isLocale(page.locale) ? page.locale : isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar";
  const s = getStoreDictionary(locale);
  const currency = getDictionary(locale).common.currency;

  // The order form goes right after the hero (or first, when the page has no hero).
  const heroIndex = page.sections.findIndex((x) => x.type === "hero");
  const before = page.sections.slice(0, heroIndex + 1);
  const rest = page.sections.slice(heroIndex + 1);

  return (
    <div
      lang={locale}
      dir={dir(locale)}
      className="mx-auto max-w-2xl space-y-10 pb-24"
      style={page.accentColor ? { ["--brand" as string]: page.accentColor } : undefined}
    >
      <RecordView pageId={page.id} record={recordLandingView.bind(null, shop.slug, page.id)} />
      {before.map((section, i) => (
        <Section key={`b${i}`} section={section} s={s} />
      ))}
      <div id="order" className="scroll-mt-20 space-y-3">
        <div className="flex items-baseline justify-center gap-3">
          <span className="text-3xl font-extrabold text-brand">{formatPrice(product.price, currency)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-xl text-slate-400 line-through">{formatPrice(product.compareAtPrice, currency)}</span>
          )}
        </div>
        <ProductCheckout shop={shop} product={product} currency={currency} locale={locale} landingPageId={page.id} />
      </div>
      {rest.map((section, i) => (
        <Section key={`r${i}`} section={section} s={s} />
      ))}
      <StickyOrderButton label={`${s.orderNow} · ${s.cod}`} />
    </div>
  );
}
