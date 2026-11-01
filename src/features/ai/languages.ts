// Languages of the call-center AI texts (call guide, customer messages, descriptions): Darija is offered here
export const aiLanguages = ["ar", "dz", "fr", "en"] as const;
export type AiLanguage = (typeof aiLanguages)[number];

export const aiLanguageRules: Record<AiLanguage, string> = {
  ar: "Write in clear, modern Standard Arabic that Algerian shoppers read easily. Short sentences.",
  dz: "Write in Algerian Darija using Arabic script, the way Algerians write in Facebook/TikTok ads (natural, warm, everyday words; French loanwords are fine when Algerians commonly use them). Keep it easy to read.",
  fr: "Write in natural French as used in Algerian e-commerce. Short sentences.",
  en: "Write in simple, natural English. Short sentences.",
};

// The store's language as the AI's default
export const storeAiLanguage = (locale: string): AiLanguage => (locale === "fr" || locale === "en" ? locale : "ar");
