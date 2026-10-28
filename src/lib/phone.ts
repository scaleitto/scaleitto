// Algerian mobile numbers: 05/06/07 + 8 digits. Accepts +213 / 00213 and spaces.
export function normalizePhone(raw: string) {
  let p = raw.replace(/[\s.\-()]/g, "");
  if (p.startsWith("+213")) p = "0" + p.slice(4);
  else if (p.startsWith("00213")) p = "0" + p.slice(5);
  return p;
}

export function isValidDzPhone(phone: string) {
  return /^0[5-7]\d{8}$/.test(phone);
}

// 0555 12 34 56 → 213555123456 (international form without +, as WhatsApp and Meta want it)
export const intlPhone = (raw: string) => `213${normalizePhone(raw).replace(/^0/, "")}`;
