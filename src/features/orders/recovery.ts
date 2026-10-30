// Abandoned carts: what to do next with each visitor who typed a phone and left, and the messages that bring them back.
// Pure (unit-tested). The page shows the suggested step first; every step is one click (call, WhatsApp, offer, order).
import type { MessageLanguage } from "@/features/messages/templates";

export const recoverySteps = ["call", "message", "offer", "order"] as const;
export type RecoveryStep = (typeof recoverySteps)[number];

// Fresh carts are called while the customer still remembers; an older or unanswered one gets a message;
// once contacted without an order, an offer (free delivery, a small discount) is the last push
export function suggestedStep(lead: { status: string; hoursAgo: number }): RecoveryStep {
  if (lead.status === "contacted") return "offer";
  return lead.hoursAgo < 6 ? "call" : "message";
}

export const recoveryTemplates: Record<MessageLanguage, { message: string; offer: string }> = {
  dz: {
    message: "السلام عليكم {name} 👋 معاك {store}.\nشفنا بلي بديت تطلب {product} وما كملتش. نقدرو نعاونوك؟ تقدر تكمل طلبيتك هنا: {link}\nالدفع عند الاستلام.",
    offer: "السلام عليكم {name}، معاك {store}.\nعندنا ليك عرض خاص على {product}: {offer} 🎁\nكمل طلبيتك هنا: {link} — ولا ابعثلنا «نعم» ونسجلوها ليك.",
  },
  ar: {
    message: "السلام عليكم {name} 👋 معك {store}.\nلاحظنا أنك بدأت طلب {product} ولم تكمله. هل نساعدك؟ يمكنك إكمال طلبك من هنا: {link}\nالدفع عند الاستلام.",
    offer: "السلام عليكم {name}، معك {store}.\nلدينا عرض خاص لك على {product}: {offer} 🎁\nأكمل طلبك من هنا: {link} — أو أرسل «نعم» ونسجله لك.",
  },
  fr: {
    message: "Bonjour {name} 👋 c'est {store}.\nVous avez commencé une commande de {product} sans la terminer. Pouvons-nous vous aider ? Terminez-la ici : {link}\nPaiement à la livraison.",
    offer: "Bonjour {name}, c'est {store}.\nNous avons une offre pour vous sur {product} : {offer} 🎁\nCommandez ici : {link} — ou répondez « Oui » et nous l'enregistrons.",
  },
  en: {
    message: "Hello {name} 👋 this is {store}.\nYou started ordering {product} but did not finish. Can we help? You can complete it here: {link}\nCash on delivery.",
    offer: "Hello {name}, this is {store}.\nWe have a special offer for you on {product}: {offer} 🎁\nOrder here: {link} — or reply “Yes” and we will register it for you.",
  },
};

export type RecoveryVars = { name: string; product: string; link: string; store: string; offer: string };
export const fillRecovery = (text: string, vars: Partial<RecoveryVars>) => text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k as keyof RecoveryVars] ?? "").replace(/ {2,}/g, " ");
