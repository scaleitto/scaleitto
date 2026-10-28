// Bumped when the script changes: the "Test" button asks merchants with an older copy to paste the new one.
export const SCRIPT_VERSION = 4;

// The Google Apps Script the merchant pastes in their sheet (Extensions → Apps Script) and deploys as a web app.
// It writes the orders Scaleitto sends: a new order adds a row, a change updates the row with the same number.
// The orders go to the "Orders" tab (in a new spreadsheet: the first, empty tab, renamed). Every answer says
// where the rows went (tab, its gid, row numbers) so the dashboard can show it and open that exact tab.
export function appsScriptCode(token: string, sheetName = "Orders") {
  return `// Scaleitto → Google Sheets (v${SCRIPT_VERSION})
const TOKEN = ${JSON.stringify(token)};
const SHEET = ${JSON.stringify(sheetName)};
const VERSION = ${SCRIPT_VERSION};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const body = JSON.parse(e && e.postData ? e.postData.contents : "{}");
    if (body.token !== TOKEN) return reply({ ok: false, error: "wrong token", version: VERSION });
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) return reply({ ok: false, error: "open the spreadsheet, then Extensions > Apps Script (the script must belong to the sheet)", version: VERSION });
    const sheet = ordersSheet(book);
    if (sheet.getLastRow() === 0) {
      sheet.getRange("A:Z").setNumberFormat("@");
      sheet.getRange(1, 1, 1, body.headers.length).setValues([body.headers]).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    const last = sheet.getLastRow();
    const keys = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    const written = body.rows.map(function (row) {
      const values = row.map(String);
      let at = keys.indexOf(values[0]);
      if (at < 0) {
        keys.push(values[0]);
        at = keys.length - 1;
      }
      sheet.getRange(at + 2, 1, 1, values.length).setValues([values]);
      return { key: values[0], row: at + 2 };
    });
    SpreadsheetApp.flush();
    return reply({ ok: true, version: VERSION, sheet: sheet.getName(), gid: sheet.getSheetId(), url: book.getUrl(), written: written });
  } catch (err) {
    return reply({ ok: false, error: String(err), version: VERSION });
  } finally {
    lock.releaseLock();
  }
}

function ordersSheet(book) {
  const named = book.getSheetByName(SHEET);
  if (named) return named;
  const first = book.getSheets()[0];
  if (first.getLastRow() === 0) return first.setName(SHEET);
  return book.insertSheet(SHEET);
}

function reply(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;
}
