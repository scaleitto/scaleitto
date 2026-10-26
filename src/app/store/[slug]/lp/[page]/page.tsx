import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LandingSection } from "@/db/schema";
import { getShopBySlug } from "@/lib/store";
import { getStoreDictionary } from "@/i18n/store";
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

function Section({ section }: { section: LandingSection }) {
  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{section.title}</h1>
          {section.subtitle && <p className="text-lg text-slate-600">{section.subtitle}</p>}
          {section.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.image} alt="" className="mx-auto w-full rounded-2xl" />
          )}
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
  const s = getStoreDictionary(shop.defaultLocale);
  const currency = getDictionary(shop.defaultLocale).common.currency;

  // The order form goes right after the hero (or first, when the page has no hero).
  const heroIndex = page.sections.findIndex((x) => x.type === "hero");
  const before = page.sections.slice(0, heroIndex + 1);
  const rest = page.sections.slice(heroIndex + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-24">
      <RecordView pageId={page.id} record={recordLandingView.bind(null, shop.slug, page.id)} />
      {before.map((section, i) => (
        <Section key={`b${i}`} section={section} />
      ))}
      <div id="order" className="scroll-mt-20 space-y-3">
        <div className="flex items-baseline justify-center gap-3">
          <span className="text-3xl font-extrabold text-brand">{formatPrice(product.price, currency)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-xl text-slate-400 line-through">{formatPrice(product.compareAtPrice, currency)}</span>
          )}
        </div>
        <ProductCheckout shop={shop} product={product} currency={currency} landingPageId={page.id} />
      </div>
      {rest.map((section, i) => (
        <Section key={`r${i}`} section={section} />
      ))}
      <StickyOrderButton label={`${s.orderNow} · ${s.cod}`} />
    </div>
  );
}
