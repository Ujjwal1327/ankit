/**
 * Contact form → Google Sheet
 *
 * Every form submission is added as a new row in the "Leads" tab.
 *
 * Setup:
 *  1. Create a Google Sheet, then open Extensions → Apps Script.
 *  2. Replace the editor's code with this whole file and save.
 *  3. Deploy → New deployment → type "Web app".
 *     Execute as: Me. Who has access: Anyone. Deploy and allow access.
 *  4. Copy the Web app URL (ends with /exec) into SHEET_URL in js/main.js.
 *
 * After editing this script later: Deploy → Manage deployments → Edit →
 * Version "New version" → Deploy. Otherwise the URL keeps running the old code.
 */

const SHEET_NAME = 'Leads';
const HEADERS = ['Timestamp', 'Name', 'Email', 'Website', 'Package', 'Message'];
const FIELDS = ['name', 'email', 'website', 'package', 'message'];
const MAX_LENGTH = 3000;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const params = (e && e.parameter) || {};

    // spam trap: real visitors never fill this hidden field
    if (params.company_hp) return json_({ result: 'success' });

    const values = FIELDS.map((field) => clean_(params[field]));
    const [name, email, , , message] = values;
    if (!name || !email || !message) {
      return json_({ result: 'error', error: 'Missing required fields' });
    }

    getSheet_().appendRow([new Date()].concat(values));
    return json_({ result: 'success' });
  } catch (err) {
    return json_({ result: 'error', error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the web app URL in a browser to check it is live
function doGet() {
  return json_({ result: 'ok', message: 'Contact form endpoint is running' });
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function clean_(value) {
  const text = String(value || '').trim().slice(0, MAX_LENGTH);
  // stop values like "=HYPERLINK(...)" from running as formulas in the sheet
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
