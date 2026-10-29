import { test } from "node:test";
import assert from "node:assert/strict";
import { nameKey, normalizeShipmentStatus, orderStatusFor, readableState, splitName } from "../../src/features/delivery/status";
import { carriers, findCarrier, normalizeEcotrackUrl, platformFields } from "../../src/features/delivery/carriers";

test("courier wording maps to the Ecotrack stages", () => {
  const cases: [string, string][] = [
    // The stages as Packers / Ecotrack show them
    ["Prêt à expédier", "ready"],
    ["En ramassage", "pickup"],
    ["Vers Station", "to_station"],
    ["En Station", "at_station"],
    ["Vers Wilaya", "to_wilaya"],
    ["En preparation", "preparing"],
    ["En livraison", "out_for_delivery"],
    ["Suspendus", "suspended"],
    ["Livrés", "delivered"],
    ["Retours", "returned"],
    ["Colis Supprimés", "deleted"],
    ["Colis Annulés", "cancelled"],
    ["Colis à supprimer", "to_delete"],
    // Other couriers' words
    ["Livré", "delivered"],
    ["En cours de livraison", "out_for_delivery"],
    ["Tentative échouée", "suspended"],
    ["Retourné", "returned"],
    ["En retour", "returning"],
    ["Annulé", "cancelled"],
    ["Reçu à l'agence", "at_station"],
    ["", "unknown"],
    ["xyz", "unknown"],
  ];
  for (const [raw, expected] of cases) assert.equal(normalizeShipmentStatus(raw), expected, raw);
  assert.equal(orderStatusFor("delivered"), "delivered");
  assert.equal(orderStatusFor("returned"), "returned");
  assert.equal(orderStatusFor("to_wilaya"), null);
});

test("ZR Express (new platform) states and place names", () => {
  const cases: [string, string][] = [
    ["livre", "delivered"],
    ["Delivered", "delivered"],
    ["encaisse", "delivered"],
    ["en_retour", "returning"],
    ["InReturn", "returning"],
    ["retour_confirme", "returned"],
    ["Returned", "returned"],
    ["echec_livraison", "suspended"],
    ["FailedDelivery", "suspended"],
    ["OutForDelivery", "out_for_delivery"],
    ["sortie_en_livraison", "out_for_delivery"],
    ["commande_annulee", "cancelled"],
    ["en_preparation", "preparing"],
  ];
  for (const [raw, expected] of cases) assert.equal(normalizeShipmentStatus(readableState(raw)), expected, raw);
  assert.equal(nameKey("Béjaïa "), nameKey("BEJAIA"));
  assert.equal(nameKey("Bab-El-Oued"), nameKey("bab el oued"));
});

test("names are split for couriers", () => {
  assert.deepEqual(splitName("Mohamed Amine Benali"), { firstName: "Mohamed Amine", lastName: "Benali" });
  assert.deepEqual(splitName("كريم"), { firstName: "كريم", lastName: "كريم" });
});

test("only https Ecotrack domains are accepted", () => {
  assert.equal(normalizeEcotrackUrl("navex.ecotrack.dz"), "https://navex.ecotrack.dz");
  assert.equal(normalizeEcotrackUrl("https://DHD.ecotrack.dz/api/v1"), "https://dhd.ecotrack.dz");
  assert.equal(normalizeEcotrackUrl("https://evil.com"), null);
  assert.equal(normalizeEcotrackUrl("http://127.0.0.1"), null);
  assert.equal(normalizeEcotrackUrl("x.ecotrack.dz.evil.com"), null);
});

test("carrier catalog is consistent", () => {
  assert.equal(new Set(carriers.map((c) => c.key)).size, carriers.length);
  for (const c of carriers) if (c.platform) assert.ok(platformFields[c.platform].length > 0);
  assert.equal(findCarrier("yalidine")?.platform, "yalidine");
  assert.equal(findCarrier("dhd")?.baseUrl, "https://dhd.ecotrack.dz");
});

test("Packers sheet: the model's 18 columns, OUI flags, quoting", async () => {
  const { PACKERS_HEADERS, packersCsv, packersRow } = await import("../../src/features/delivery/packers-sheet");
  assert.equal(PACKERS_HEADERS.length, 18);
  const parcel = {
    reference: "1001", fullName: "Amine, Benali", firstName: "Amine", lastName: "Benali", phone: "0661234567", phone2: "0550000000",
    wilayaCode: 16, wilayaName: "Alger", commune: "Kouba", address: "", products: "Montre x1", codAmount: 2900, stopDesk: true,
    note: "Appeler avant — FRAGILE", originWilayaCode: 16, originWilayaName: "Alger", kind: "exchange" as const, fragile: true, weight: 1.5,
    itemToCollect: "", mapLink: "",
  };
  const row = packersRow(parcel);
  assert.equal(row.length, 18);
  assert.deepEqual(row.slice(7, 17), ["Kouba", "Montre x1", 1.5, 2900, "Appeler avant", "OUI", "OUI", "", "", "OUI"]);
  const csv = packersCsv([parcel]);
  assert.ok(csv.startsWith("﻿reference commande,"));
  assert.ok(csv.includes('"Amine, Benali"'), "commas quoted");
  assert.equal(csv.trim().split("\r\n").length, 2, "the header (its line breaks stay inside quotes) and one row");
});
