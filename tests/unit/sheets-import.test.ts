import { test } from "node:test";
import assert from "node:assert/strict";
import { detectColumns, parseSheetRow, resolveSheetImport, sheetColumnLabel, sheetsImportScript, splitHeaders } from "../../src/features/channels/sheets";

test("sheet import: header row split and columns suggested (ar / fr / en)", () => {
  assert.deepEqual(splitHeaders("الاسم، الهاتف، الولاية"), ["الاسم", "الهاتف", "الولاية"]);
  assert.deepEqual(splitHeaders("Nom\tTéléphone\tWilaya"), ["Nom", "Téléphone", "Wilaya"]);
  const fr = detectColumns(splitHeaders("Date, Nom complet, Téléphone, Wilaya, Commune, Adresse, Produit, Qté, Prix, Remarque, Statut"));
  assert.deepEqual(fr, { name: 1, phone: 2, wilaya: 3, commune: 4, address: 5, product: 6, quantity: 7, unitPrice: 8, note: 9, status: 10 });
  const ar = detectColumns(["الاسم", "رقم الهاتف", "الولاية", "المنتج", "الحالة"]);
  assert.equal(ar.name, 0);
  assert.equal(ar.phone, 1);
  assert.equal(ar.status, 4);
  assert.equal(ar.quantity, null);
  assert.equal(sheetColumnLabel(["a", "b"], 1), "B · b");
});

test("sheet import: settings cleaned, a row becomes an order once (row reference)", () => {
  const settings = resolveSheetImport({ headers: ["Nom", "Tel", "Wilaya", "Produit", "Qte", "Prix"], columns: { name: 0, phone: 1, wilaya: 2, product: 3, quantity: 4, unitPrice: 5, status: 99 }, scriptUrl: "javascript:x" })!;
  assert.equal(settings.columns.status, null, "a column outside the header row is dropped");
  assert.equal(settings.scriptUrl, null);
  const order = parseSheetRow({ sheet: "abc", row: 7, values: ["Amine", "0550 12 34 56", "Oran", "Montre", "2", "3 500 DA"] }, settings)!;
  assert.equal(order.ref, "google_sheets:abc:7");
  assert.equal(order.phone, "0550123456");
  assert.equal(order.wilayaCode, 31);
  assert.deepEqual(order.lines, [{ name: "Montre", variant: null, sku: null, quantity: 2, unitPrice: 3500 }]);
  assert.equal(parseSheetRow({ sheet: "abc", row: 1, values: ["Nom"] }, settings), null, "the header row is never an order");
  assert.equal(parseSheetRow({ sheet: "abc", row: 8, values: ["", "", ""] }, settings), null, "empty rows are skipped");
  const script = sheetsImportScript("https://x/api/channels/t", "s3cret", 4);
  assert.ok(script.includes("var STATUS_COLUMN = 5;") && script.includes('"s3cret"') && script.includes("function doPost"));
});
