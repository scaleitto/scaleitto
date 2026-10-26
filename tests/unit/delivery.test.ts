import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShipmentStatus, orderStatusFor, splitName } from "../../src/features/delivery/status";
import { carriers, findCarrier, normalizeEcotrackUrl, platformFields } from "../../src/features/delivery/carriers";

test("courier wording maps to one status set", () => {
  const cases: [string, string][] = [
    ["Livré", "delivered"],
    ["En cours de livraison", "out_for_delivery"],
    ["Tentative échouée", "attempted"],
    ["Retourné", "returned"],
    ["En retour", "returning"],
    ["Annulé", "cancelled"],
    ["Reçu à l'agence", "in_transit"],
    ["En préparation", "created"],
    ["", "unknown"],
    ["xyz", "unknown"],
  ];
  for (const [raw, expected] of cases) assert.equal(normalizeShipmentStatus(raw), expected, raw);
  assert.equal(orderStatusFor("delivered"), "delivered");
  assert.equal(orderStatusFor("returned"), "returned");
  assert.equal(orderStatusFor("in_transit"), null);
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
