import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VisitPing } from "@/features/analytics/VisitPing";
import { getShopBySlug } from "@/features/storefront/queries";
import { StoreSections } from "@/features/storefront/sections";
import { sectionData } from "@/features/storefront/page-data";
import { resolveDesign } from "@/features/design/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";

async function load(params: PageProps<"/store/[slug]/pages/[handle]">["params"]) {
  const { slug, handle } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const page = resolveDesign(shop.design).pages.custom.find((p) => p.handle === decodeURIComponent(handle));
  if (!page) notFound();
  return { shop, page };
}

export async function generateMetadata({ params }: PageProps<"/store/[slug]/pages/[handle]">): Promise<Metadata> {
  const { page } = await load(params);
  return { title: page.title };
}

// A custom page built in Store Design ("Add custom page"), published sections only
export default async function CustomStorePage({ params }: PageProps<"/store/[slug]/pages/[handle]">) {
  const { shop, page } = await load(params);
  const [data, pixels] = await Promise.all([sectionData(shop), pagePixels(shop.id)]);
  return (
    <div className="space-y-8" data-testid="custom-page">
      <PixelScope pixels={pixels} />
      <VisitPing shopId={shop.id} />
      <h1 className="text-3xl font-extrabold tracking-tight">{page.title}</h1>
      <StoreSections sections={page.sections} data={data} />
    </div>
  );
}
