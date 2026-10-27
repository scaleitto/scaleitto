// The Google Apps Script the merchant pastes in their sheet (Extensions → Apps Script) and deploys as a web app.
// It writes the orders Scaleitto sends: a new order adds a row, a change updates the row with the same number.
export function appsScriptCode(token: string, sheetName = "Orders") {
  return `// Scaleitto → Google Sheets
const TOKEN = ${JSON.stringify(token)};
const SHEET = ${JSON.stringify(sheetName)};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return reply({ ok: false, error: "wrong token" });
    const book = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = book.getSheetByName(SHEET);
    if (!sheet) sheet = book.insertSheet(SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.getRange("A:Z").setNumberFormat("@");
      sheet.appendRow(body.headers);
      sheet.getRange(1, 1, 1, body.headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    const last = sheet.getLastRow();
    const keys = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    body.rows.forEach(function (row) {
      const values = row.map(String);
      const at = keys.indexOf(values[0]);
      if (at >= 0) sheet.getRange(at + 2, 1, 1, values.length).setValues([values]);
      else {
        sheet.appendRow(values);
        keys.push(values[0]);
      }
    });
    return reply({ ok: true, count: body.rows.length });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function reply(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;
}
