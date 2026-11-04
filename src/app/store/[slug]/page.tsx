import { notFound } from "next/navigation";
import { VisitPing } from "@/features/analytics/VisitPing";
import { getShopBySlug } from "@/features/storefront/queries";
import { StoreSections } from "@/features/storefront/sections";
import { sectionData } from "@/features/storefront/page-data";
import { resolveDesign } from "@/features/design/types";
import { PixelScope } from "@/features/pixels/PixelScope";
import { pagePixels } from "@/features/pixels/queries";

// The store's home page: the published sections of Store Design
export default async function StoreHome({ params }: PageProps<"/store/[slug]">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const [data, pixels] = await Promise.all([sectionData(shop), pagePixels(shop.id)]);
  return (
    <>
      <PixelScope pixels={pixels} />
      <VisitPing shopId={shop.id} />
      <StoreSections sections={resolveDesign(shop.design).pages.home} data={data} />
    </>
  );
}
