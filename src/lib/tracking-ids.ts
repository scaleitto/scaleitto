// Pixel IDs end up inside inline <script> tags, so they must match strict formats.
export const trackingIdPatterns = {
  metaPixelId: /^\d{5,20}$/,
  tiktokPixelId: /^[A-Z0-9]{10,30}$/i,
  gtmId: /^GTM-[A-Z0-9]{4,12}$/i,
};

export type TrackingIds = { metaPixelId: string | null; tiktokPixelId: string | null; gtmId: string | null };

export function safeTrackingIds(ids: TrackingIds): TrackingIds {
  return {
    metaPixelId: ids.metaPixelId && trackingIdPatterns.metaPixelId.test(ids.metaPixelId) ? ids.metaPixelId : null,
    tiktokPixelId: ids.tiktokPixelId && trackingIdPatterns.tiktokPixelId.test(ids.tiktokPixelId) ? ids.tiktokPixelId : null,
    gtmId: ids.gtmId && trackingIdPatterns.gtmId.test(ids.gtmId) ? ids.gtmId.toUpperCase() : null,
  };
}
