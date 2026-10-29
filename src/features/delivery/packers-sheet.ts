import type { ParcelInput } from "./platforms/types";

// The Packers import sheet (model_google_sheet_packers.xlsx sent by the owner): same columns, same headers, so a file
// exported here can be pasted into the Packers Google Sheet / imported in their dashboard as it is.
export const PACKERS_HEADERS = [
  "reference commande",
  "nom et prenom du destinataire*",
  "telephone*",
  "telephone 2",
  "code wilaya*",
  "wilaya de livraison",
  "commune de livraison*",
  "adresse de livraison*",
  "produit*",
  "poids (kg)",
  "montant du colis*",
  "remarque",
  "FRAGILE\n( si oui mettez OUI sinon laissez vide )",
  "ECHANGE\n( si oui mettez OUI sinon laissez vide )",
  "PICK UP\n( si oui mettez OUI sinon laissez vide )",
  "RECOUVREMENT\n( si oui mettez OUI sinon laissez vide )",
  "STOP DESK\n( si oui mettez OUI sinon laissez vide )",
  "Lien map",
];

const yes = (v: boolean) => (v ? "OUI" : "");

export function packersRow(p: ParcelInput): (string | number)[] {
  return [
    p.reference,
    p.fullName,
    p.phone,
    p.phone2,
    p.wilayaCode,
    p.wilayaName,
    p.commune,
    p.address || p.commune,
    p.products,
    p.weight ?? "",
    p.codAmount,
    // FRAGILE has its own column here
    p.note.replace(/( — )?FRAGILE$/, ""),
    yes(p.fragile),
    yes(p.kind === "exchange"),
    yes(p.kind === "pickup"),
    yes(p.kind === "recovery"),
    yes(p.stopDesk),
    p.mapLink,
  ];
}

// CSV with a byte-order mark so Excel and Google Sheets read the Arabic names correctly
export function packersCsv(parcels: ParcelInput[]) {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [PACKERS_HEADERS, ...parcels.map(packersRow)].map((row) => row.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
