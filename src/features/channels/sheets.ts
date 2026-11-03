// Google Sheets → orders (Connected platforms → Google Sheets → Import orders). Pure: shared by the dashboard, the receiving
// route and the unit tests. The merchant pastes the sheet's header row, we suggest which column holds each field, and a
// script in the sheet (sheetsImportScript) sends every new row here signed with the channel's secret; the order's status
// is written back into the sheet's status column when it changes.
import { normalizePhone } from "@/lib/phone";
import { wilayaFrom, type ExternalOrder } from "./parse";

export const sheetFields = ["name", "phone", "wilaya", "commune", "address", "product", "quantity", "unitPrice", "note", "status"] as const;
export type SheetField = (typeof sheetFields)[number];
export const requiredSheetFields: SheetField[] = ["name", "phone"];

// column index per field (0 = column A), null = not in the sheet
export type SheetColumns = Record<SheetField, number | null>;
export type SheetImport = { headers: string[]; columns: SheetColumns; scriptUrl: string | null };

const MAX_COLUMNS = 40;

// "Nom, Téléphone, Wilaya" → ["Nom", "Téléphone", "Wilaya"]; a tab-separated row (copied from the sheet) works too
export function splitHeaders(row: string): string[] {
  const parts = row.includes("\t") ? row.split("\t") : row.split(/[,،;]/);
  return parts.map((h) => h.trim().slice(0, 60)).filter((h, i, all) => h || i < all.length - 1).slice(0, MAX_COLUMNS);
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-.:()]/g, "");

// Words that usually name each column (ar / fr / en); the first header containing one wins
const hints: Record<SheetField, string[]> = {
  name: ["الاسم", "اسمالزبون", "الزبون", "nom", "client", "fullname", "name", "customer"],
  phone: ["الهاتف", "رقم", "هاتف", "telephone", "tel", "phone", "mobile", "numero"],
  wilaya: ["الولاية", "ولاية", "wilaya", "state", "province", "region"],
  commune: ["البلدية", "بلدية", "commune", "city", "ville", "daira"],
  address: ["العنوان", "عنوان", "adresse", "address"],
  product: ["المنتج", "منتج", "produit", "product", "article", "item"],
  quantity: ["الكمية", "كمية", "quantite", "qte", "quantity", "qty"],
  unitPrice: ["السعر", "سعر", "prix", "price", "montant", "total"],
  note: ["ملاحظة", "ملاحظات", "note", "remarque", "comment"],
  status: ["الحالة", "حالة", "statut", "etat", "status"],
};

export function detectColumns(headers: string[]): SheetColumns {
  const used = new Set<number>();
  const columns = Object.fromEntries(sheetFields.map((f) => [f, null])) as SheetColumns;
  for (const field of sheetFields) {
    const words = hints[field].map(plain);
    const i = headers.findIndex((h, idx) => !used.has(idx) && words.some((w) => plain(h).includes(w)));
    if (i >= 0) {
      columns[field] = i;
      used.add(i);
    }
  }
  return columns;
}

// Settings saved on the channel, always read through here (bad values dropped)
export function resolveSheetImport(raw: unknown): SheetImport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const headers = Array.isArray(r.headers) ? r.headers.filter((h): h is string => typeof h === "string").map((h) => h.slice(0, 60)).slice(0, MAX_COLUMNS) : [];
  const cols = (r.columns && typeof r.columns === "object" ? r.columns : {}) as Record<string, unknown>;
  const columns = Object.fromEntries(
    sheetFields.map((f) => {
      const v = cols[f];
      return [f, Number.isInteger(v) && (v as number) >= 0 && (v as number) < Math.max(headers.length, 1) ? v : null];
    }),
  ) as SheetColumns;
  // Checked when saved (channels/actions.ts validScriptUrl)
  const scriptUrl = typeof r.scriptUrl === "string" && /^https?:\/\/\S{8,300}$/.test(r.scriptUrl) ? r.scriptUrl : null;
  return { headers, columns, scriptUrl };
}

const cell = (values: unknown[], i: number | null, max = 200) => {
  if (i === null) return "";
  const v = values[i];
  return (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim().slice(0, max);
};
const amount = (v: string) => {
  const n = Math.round(Number(v.replace(/[^\d.,]/g, "").replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// One row sent by the script: { sheet: spreadsheet id, row: row number, values: [...] } → an order (null = nothing to import)
export function parseSheetRow(body: unknown, settings: SheetImport): ExternalOrder | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const row = Number(b.row);
  const sheet = typeof b.sheet === "string" ? b.sheet.replace(/[^\w-]/g, "").slice(0, 60) : "";
  if (!Number.isInteger(row) || row < 2 || !Array.isArray(b.values)) return null;
  const values = b.values.slice(0, MAX_COLUMNS);
  const c = settings.columns;
  const name = cell(values, c.name, 120);
  const phone = normalizePhone(cell(values, c.phone, 30));
  if (!name && !phone) return null;
  const product = cell(values, c.product);
  const quantity = Math.min(1000, Math.max(1, Math.round(Number(cell(values, c.quantity)) || 1)));
  const price = amount(cell(values, c.unitPrice));
  return {
    // A row is one order, whatever is typed in it later
    ref: `google_sheets:${sheet}:${row}`,
    label: `#${row}`,
    name,
    phone,
    wilayaCode: wilayaFrom(cell(values, c.wilaya, 80)),
    commune: cell(values, c.commune, 120),
    address: cell(values, c.address, 255) || null,
    note: cell(values, c.note, 500) || null,
    lines: product ? [{ name: product, variant: null, sku: null, quantity, unitPrice: price }] : [],
    shipping: 0,
    total: 0,
  };
}

const columnLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export const sheetColumnLabel = (headers: string[], i: number) => `${columnLetter(i)} · ${headers[i] || "—"}`;

// The script the merchant pastes into the sheet (Extensions → Apps Script). setup() installs a trigger that sends new rows
// every minute; a row is sent once (marked in the status column, or remembered as the last row sent); doPost receives the
// order's status from the store and writes it into the status column of the row it came from.
export function sheetsImportScript(endpoint: string, secret: string, statusColumn: number | null): string {
  return `// Scaleitto — orders from this sheet (import)
var ENDPOINT = ${JSON.stringify(endpoint)};
var SECRET = ${JSON.stringify(secret)};
var STATUS_COLUMN = ${statusColumn === null ? "null" : statusColumn + 1}; // 1 = column A

// Run once: Run ▸ setup, then allow the permissions
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "sendNewRows") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("sendNewRows").timeBased().everyMinutes(1).create();
  sendNewRows();
}

function sign(body) {
  return Utilities.base64Encode(Utilities.computeHmacSha256Signature(body, SECRET));
}

function sendNewRows() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheets()[0];
    var props = PropertiesService.getScriptProperties();
    var last = sheet.getLastRow();
    var from = STATUS_COLUMN ? 2 : Number(props.getProperty("lastRow") || 1) + 1;
    if (last < from) return;
    var width = sheet.getLastColumn();
    var rows = sheet.getRange(from, 1, last - from + 1, width).getDisplayValues();
    for (var i = 0; i < rows.length; i++) {
      var rowNumber = from + i;
      var values = rows[i];
      if (values.join("").trim() === "") continue;
      if (STATUS_COLUMN && String(values[STATUS_COLUMN - 1] || "").trim() !== "") continue;
      var body = JSON.stringify({ sheet: book.getId(), row: rowNumber, values: values });
      var res = UrlFetchApp.fetch(ENDPOINT, { method: "post", contentType: "application/json", payload: body, headers: { "X-Scaleitto-Signature": sign(body) }, muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) break;
      var answer = JSON.parse(res.getContentText() || "{}");
      if (STATUS_COLUMN) sheet.getRange(rowNumber, STATUS_COLUMN).setValue(answer.status || "#" + (answer.number || ""));
      else props.setProperty("lastRow", String(rowNumber));
    }
  } finally {
    lock.releaseLock();
  }
}

// The store writes an order's new status back here (Deploy ▸ New deployment ▸ Web app, access: Anyone)
function doPost(e) {
  var body = e.postData.contents;
  var given = (e.parameter && e.parameter.signature) || "";
  if (given !== sign(body)) return ContentService.createTextOutput("refused");
  var data = JSON.parse(body);
  if (STATUS_COLUMN && data.row >= 2) SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getRange(data.row, STATUS_COLUMN).setValue(data.status);
  return ContentService.createTextOutput("ok");
}
`;
}
