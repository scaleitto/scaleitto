// The 69 Algerian wilayas (Law 26-06, April 2026, created 59–69). Codes 1–58 are the ones delivery companies use; a new
// wilaya keeps its `parent` (the wilaya it was taken from) so parcels and missing delivery prices can fall back to it.
export const wilayas: { code: number; ar: string; fr: string; parent?: number }[] = [
  { code: 1, ar: "أدرار", fr: "Adrar" },
  { code: 2, ar: "الشلف", fr: "Chlef" },
  { code: 3, ar: "الأغواط", fr: "Laghouat" },
  { code: 4, ar: "أم البواقي", fr: "Oum El Bouaghi" },
  { code: 5, ar: "باتنة", fr: "Batna" },
  { code: 6, ar: "بجاية", fr: "Béjaïa" },
  { code: 7, ar: "بسكرة", fr: "Biskra" },
  { code: 8, ar: "بشار", fr: "Béchar" },
  { code: 9, ar: "البليدة", fr: "Blida" },
  { code: 10, ar: "البويرة", fr: "Bouira" },
  { code: 11, ar: "تمنراست", fr: "Tamanrasset" },
  { code: 12, ar: "تبسة", fr: "Tébessa" },
  { code: 13, ar: "تلمسان", fr: "Tlemcen" },
  { code: 14, ar: "تيارت", fr: "Tiaret" },
  { code: 15, ar: "تيزي وزو", fr: "Tizi Ouzou" },
  { code: 16, ar: "الجزائر", fr: "Alger" },
  { code: 17, ar: "الجلفة", fr: "Djelfa" },
  { code: 18, ar: "جيجل", fr: "Jijel" },
  { code: 19, ar: "سطيف", fr: "Sétif" },
  { code: 20, ar: "سعيدة", fr: "Saïda" },
  { code: 21, ar: "سكيكدة", fr: "Skikda" },
  { code: 22, ar: "سيدي بلعباس", fr: "Sidi Bel Abbès" },
  { code: 23, ar: "عنابة", fr: "Annaba" },
  { code: 24, ar: "قالمة", fr: "Guelma" },
  { code: 25, ar: "قسنطينة", fr: "Constantine" },
  { code: 26, ar: "المدية", fr: "Médéa" },
  { code: 27, ar: "مستغانم", fr: "Mostaganem" },
  { code: 28, ar: "المسيلة", fr: "M'Sila" },
  { code: 29, ar: "معسكر", fr: "Mascara" },
  { code: 30, ar: "ورقلة", fr: "Ouargla" },
  { code: 31, ar: "وهران", fr: "Oran" },
  { code: 32, ar: "البيض", fr: "El Bayadh" },
  { code: 33, ar: "إليزي", fr: "Illizi" },
  { code: 34, ar: "برج بوعريريج", fr: "Bordj Bou Arréridj" },
  { code: 35, ar: "بومرداس", fr: "Boumerdès" },
  { code: 36, ar: "الطارف", fr: "El Tarf" },
  { code: 37, ar: "تندوف", fr: "Tindouf" },
  { code: 38, ar: "تيسمسيلت", fr: "Tissemsilt" },
  { code: 39, ar: "الوادي", fr: "El Oued" },
  { code: 40, ar: "خنشلة", fr: "Khenchela" },
  { code: 41, ar: "سوق أهراس", fr: "Souk Ahras" },
  { code: 42, ar: "تيبازة", fr: "Tipaza" },
  { code: 43, ar: "ميلة", fr: "Mila" },
  { code: 44, ar: "عين الدفلى", fr: "Aïn Defla" },
  { code: 45, ar: "النعامة", fr: "Naâma" },
  { code: 46, ar: "عين تموشنت", fr: "Aïn Témouchent" },
  { code: 47, ar: "غرداية", fr: "Ghardaïa" },
  { code: 48, ar: "غليزان", fr: "Relizane" },
  { code: 49, ar: "تيميمون", fr: "Timimoun" },
  { code: 50, ar: "برج باجي مختار", fr: "Bordj Badji Mokhtar" },
  { code: 51, ar: "أولاد جلال", fr: "Ouled Djellal" },
  { code: 52, ar: "بني عباس", fr: "Béni Abbès" },
  { code: 53, ar: "عين صالح", fr: "In Salah" },
  { code: 54, ar: "عين قزام", fr: "In Guezzam" },
  { code: 55, ar: "تقرت", fr: "Touggourt" },
  { code: 56, ar: "جانت", fr: "Djanet" },
  { code: 57, ar: "المغير", fr: "El M'Ghair" },
  { code: 58, ar: "المنيعة", fr: "El Meniaa" },
  { code: 59, ar: "آفلو", fr: "Aflou", parent: 3 },
  { code: 60, ar: "بريكة", fr: "Barika", parent: 5 },
  { code: 61, ar: "القنطرة", fr: "El Kantara", parent: 7 },
  { code: 62, ar: "بئر العاتر", fr: "Bir El Ater", parent: 12 },
  { code: 63, ar: "العريشة", fr: "El Aricha", parent: 13 },
  { code: 64, ar: "قصر الشلالة", fr: "Ksar Chellala", parent: 14 },
  { code: 65, ar: "عين وسارة", fr: "Aïn Ouessara", parent: 17 },
  { code: 66, ar: "مسعد", fr: "Messaad", parent: 17 },
  { code: 67, ar: "قصر البخاري", fr: "Ksar El Boukhari", parent: 26 },
  { code: 68, ar: "بوسعادة", fr: "Bou Saâda", parent: 28 },
  { code: 69, ar: "الأبيض سيدي الشيخ", fr: "El Abiodh Sidi Cheikh", parent: 32 },
];

export const WILAYA_COUNT = wilayas.length;

// The wilaya a new wilaya was taken from (itself for 1–58)
export function parentWilaya(code: number) {
  return wilayas.find((w) => w.code === code)?.parent ?? code;
}

// What the delivery companies receive: their APIs still list the 58 older wilayas, so a parcel for a new wilaya goes to
// its former wilaya (the commune name, unchanged, says where exactly).
export function carrierWilaya(code: number) {
  const parent = parentWilaya(code);
  const w = wilayas.find((x) => x.code === parent);
  return { code: parent, fr: w?.fr ?? String(parent), ar: w?.ar ?? String(parent) };
}

export function wilayaName(code: number, locale: string) {
  const w = wilayas.find((x) => x.code === code);
  if (!w) return String(code);
  return `${String(code).padStart(2, "0")} - ${locale === "ar" ? w.ar : w.fr}`;
}

// The wilaya's name alone (Zimam's tables and map): "Béjaïa" / "بجاية"
export function wilayaTitle(code: number, locale: string) {
  const w = wilayas.find((x) => x.code === code);
  return w ? (locale === "ar" ? w.ar : w.fr) : String(code);
}
