// Messages agents send to customers by WhatsApp or SMS (from their own phone, one click).
// Pure module: defaults per language, the shop's saved texts, placeholder filling, links.
import { normalizePhone } from "@/lib/phone";

export const messageKinds = ["confirm", "noAnswer", "unreachable", "postponed", "shipped", "delivery"] as const;
export type MessageKind = (typeof messageKinds)[number];
export const messageLanguages = ["dz", "ar", "fr", "en"] as const;
export type MessageLanguage = (typeof messageLanguages)[number];
export const placeholders = ["name", "order", "product", "total", "wilaya", "store", "storePhone", "tracking"] as const;
export type MessageVars = Record<(typeof placeholders)[number], string>;
export const MAX_MESSAGE = 600;

export type ShopMessages = { language: MessageLanguage; templates: Partial<Record<MessageKind, string>> };

export const defaultTemplates: Record<MessageLanguage, Record<MessageKind, string>> = {
  dz: {
    confirm: "السلام عليكم {name} 👋\nمعاك {store}. وصلتنا طلبيتك رقم {order}: {product}\nالمجموع {total} مع التوصيل لـ {wilaya}.\nأكّدلنا الطلبية بكلمة «نعم» باش نبعثوهالك في أقرب وقت.",
    noAnswer: "السلام عليكم {name}، معاك {store}. عيّطنالك باش نأكدو طلبيتك رقم {order} ({product}) وما رديتش.\nابعثلنا «نعم» باش نأكدوها، ولا قولنا الوقت اللي يناسبك نعاودو نعيطولك.",
    unreachable: "السلام عليكم {name}، معاك {store}. حاولنا نتصلو بيك على طلبيتك رقم {order} ({product}) بصح الهاتف خارج التغطية.\nكي تشوف هاد الرسالة ابعثلنا «نعم» لتأكيد الطلبية.",
    postponed: "السلام عليكم {name}، معاك {store}. كيما تفاهمنا، راح نعاودو نتصلو بيك على طلبيتك رقم {order}.\nإذا حاب تأكدها دروك ابعثلنا «نعم».",
    shipped: "السلام عليكم {name}، طلبيتك رقم {order} خرجت مع شركة التوصيل ✅\nرقم التتبع: {tracking}\nحضّر {total} للموصّل. شكراً على ثقتك في {store}.",
    delivery: "السلام عليكم {name}، الموصّل راح يتصل بيك اليوم باش يوصّلك طلبيتك رقم {order}.\nخلّي الهاتف مفتوح من فضلك 🙏 — {store}",
  },
  ar: {
    confirm: "السلام عليكم {name} 👋\nمعك {store}. وصلنا طلبك رقم {order}: {product}\nالمجموع {total} مع التوصيل إلى {wilaya}.\nأكّد لنا الطلب بالرد بكلمة «نعم» لنرسله لك في أقرب وقت.",
    noAnswer: "السلام عليكم {name}، معك {store}. اتصلنا بك لتأكيد طلبك رقم {order} ({product}) ولم نتمكن من الوصول إليك.\nأرسل «نعم» لتأكيده، أو أخبرنا بالوقت المناسب لنعاود الاتصال.",
    unreachable: "السلام عليكم {name}، معك {store}. حاولنا الاتصال بك بخصوص طلبك رقم {order} ({product}) لكن الهاتف خارج التغطية.\nعند قراءة هذه الرسالة أرسل «نعم» لتأكيد الطلب.",
    postponed: "السلام عليكم {name}، معك {store}. كما اتفقنا، سنعاود الاتصال بك بخصوص طلبك رقم {order}.\nإن أردت تأكيده الآن أرسل «نعم».",
    shipped: "السلام عليكم {name}، تم شحن طلبك رقم {order} ✅\nرقم التتبع: {tracking}\nجهّز مبلغ {total} للموصّل. شكراً لثقتك في {store}.",
    delivery: "السلام عليكم {name}، سيتصل بك الموصّل اليوم لتسليم طلبك رقم {order}.\nيرجى إبقاء الهاتف مفتوحاً 🙏 — {store}",
  },
  fr: {
    confirm: "Bonjour {name} 👋\nC'est {store}. Nous avons bien reçu votre commande n° {order} : {product}\nTotal {total}, livraison à {wilaya} comprise.\nRépondez « Oui » pour la confirmer et nous l'expédions au plus vite.",
    noAnswer: "Bonjour {name}, c'est {store}. Nous vous avons appelé pour confirmer votre commande n° {order} ({product}), sans réponse.\nRépondez « Oui » pour la confirmer, ou indiquez-nous quand vous rappeler.",
    unreachable: "Bonjour {name}, c'est {store}. Nous avons essayé de vous joindre pour votre commande n° {order} ({product}) mais votre téléphone était injoignable.\nRépondez « Oui » pour la confirmer.",
    postponed: "Bonjour {name}, c'est {store}. Comme convenu, nous vous rappellerons pour votre commande n° {order}.\nPour la confirmer dès maintenant, répondez « Oui ».",
    shipped: "Bonjour {name}, votre commande n° {order} est expédiée ✅\nN° de suivi : {tracking}\nPrévoyez {total} pour le livreur. Merci de votre confiance — {store}",
    delivery: "Bonjour {name}, le livreur vous appellera aujourd'hui pour votre commande n° {order}.\nMerci de garder votre téléphone allumé 🙏 — {store}",
  },
  en: {
    confirm: "Hello {name} 👋\nThis is {store}. We received your order #{order}: {product}\nTotal {total}, delivery to {wilaya} included.\nReply “Yes” to confirm it and we will ship it right away.",
    noAnswer: "Hello {name}, this is {store}. We called to confirm your order #{order} ({product}) but could not reach you.\nReply “Yes” to confirm it, or tell us when to call you back.",
    unreachable: "Hello {name}, this is {store}. We tried to reach you about your order #{order} ({product}) but your phone was unreachable.\nReply “Yes” to confirm it.",
    postponed: "Hello {name}, this is {store}. As agreed, we will call you again about your order #{order}.\nTo confirm it now, reply “Yes”.",
    shipped: "Hello {name}, your order #{order} has shipped ✅\nTracking number: {tracking}\nPlease have {total} ready for the courier. Thank you — {store}",
    delivery: "Hello {name}, the courier will call you today to deliver your order #{order}.\nPlease keep your phone on 🙏 — {store}",
  },
};

const isLanguage = (v: unknown): v is MessageLanguage => messageLanguages.includes(v as MessageLanguage);

// Keeps only known placeholders ({name}…); anything else in braces is dropped
export function cleanTemplate(text: string) {
  return text
    .replace(/\{(\w+)\}/g, (m, key: string) => ((placeholders as readonly string[]).includes(key) ? m : ""))
    .trim()
    .slice(0, MAX_MESSAGE);
}

// The shop's saved messages over the defaults of their language
export function resolveMessages(value: unknown): ShopMessages & { texts: Record<MessageKind, string> } {
  const v = (value && typeof value === "object" ? value : {}) as { language?: unknown; templates?: Record<string, unknown> };
  const language = isLanguage(v.language) ? v.language : "dz";
  const templates: ShopMessages["templates"] = {};
  for (const k of messageKinds) {
    const t = v.templates?.[k];
    if (typeof t === "string" && t.trim()) templates[k] = cleanTemplate(t);
  }
  const texts = Object.fromEntries(messageKinds.map((k) => [k, templates[k] ?? defaultTemplates[language][k]])) as Record<MessageKind, string>;
  return { language, templates, texts };
}

export const fillTemplate = (text: string, vars: Partial<MessageVars>) => text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key as keyof MessageVars] ?? "");

// The message that fits the order's situation
export function suggestedKind(status: string): MessageKind {
  return status === "no_answer" ? "noAnswer" : status === "postponed" ? "postponed" : status === "shipped" ? "shipped" : status === "confirmed" ? "delivery" : "confirm";
}

// 0555 12 34 56 → 213555123456 (WhatsApp wants the international number without +)
export const whatsappLink = (phone: string, text: string) => `https://wa.me/213${normalizePhone(phone).replace(/^0/, "")}?text=${encodeURIComponent(text)}`;
export const smsLink = (phone: string, text: string) => `sms:${normalizePhone(phone)}?body=${encodeURIComponent(text)}`;
