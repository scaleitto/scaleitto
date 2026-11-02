import { Ban, BadgeCheck, Boxes, CreditCard, Download, Layers, ListChecks, MapPin, MessageCircle, PartyPopper, Phone, QrCode, ScanLine, ShieldCheck, ShoppingBag, ShoppingCart, Tag, Truck, UserCheck, Webhook, type LucideIcon } from "lucide-react";

// Zimam's Apps page, in its order (plus our webhook at the end). `ready` = built here; the others are shown as coming.
export const appKeys = [
  "whatsapp",
  "cart",
  "abandoned",
  "fakeGuard",
  "agentAssign",
  "deliveryAssign",
  "blacklist",
  "trustBadges",
  "quickContact",
  "thankYou",
  "qrCode",
  "orderTracking",
  "promotions",
  "productImport",
  "customFields",
  "collections",
  "parcelScanner",
  "payments",
  "wholesale",
  "webhook",
] as const;
export type AppPageKey = (typeof appKeys)[number];

export const readyApps: AppPageKey[] = ["cart", "abandoned", "fakeGuard", "agentAssign", "deliveryAssign", "blacklist", "trustBadges", "quickContact", "thankYou", "qrCode", "orderTracking", "promotions", "productImport", "customFields", "collections", "parcelScanner", "wholesale", "webhook"];

export const appIcons: Record<AppPageKey, LucideIcon> = {
  whatsapp: MessageCircle,
  cart: ShoppingBag,
  abandoned: ShoppingCart,
  fakeGuard: ShieldCheck,
  agentAssign: UserCheck,
  deliveryAssign: Truck,
  blacklist: Ban,
  trustBadges: BadgeCheck,
  quickContact: Phone,
  thankYou: PartyPopper,
  qrCode: QrCode,
  orderTracking: MapPin,
  promotions: Tag,
  productImport: Download,
  customFields: ListChecks,
  collections: Boxes,
  parcelScanner: ScanLine,
  payments: CreditCard,
  wholesale: Layers,
  webhook: Webhook,
};
