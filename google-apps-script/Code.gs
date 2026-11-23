/**
 * Contact form → Google Sheet + email
 *
 * Every form submission is added as a new row in the "Leads" tab,
 * and a copy is emailed to NOTIFY_EMAIL.
 *
 * Setup:
 *  1. Create a Google Sheet, then open Extensions → Apps Script.
 *  2. Replace the editor's code with this whole file and save.
 *  3. Select the function "sendTestEmail" at the top and click Run once.
 *     Allow the permissions Google asks for (it needs "send email as you").
 *     Check that the test email arrives.
 *  4. Deploy → New deployment → type "Web app".
 *     Execute as: Me. Who has access: Anyone. Deploy and allow access.
 *  5. Copy the Web app URL (ends with /exec) into the website's contact form.
 *
 * After editing this script later: Deploy → Manage deployments → Edit →
 * Version "New version" → Deploy. Otherwise the URL keeps running the old code.
 */

const SHEET_NAME = 'Leads';
const HEADERS = ['Timestamp', 'Name', 'Email', 'Website', 'Package', 'Message'];
const FIELDS = ['name', 'email', 'website', 'package', 'message'];
const MAX_LENGTH = 3000;

// New leads are emailed here. Separate several addresses with commas.
const NOTIFY_EMAIL = 'ankit65604@gmail.com';

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

    // The lead is already saved, so a mail problem (e.g. daily quota) must not show the visitor an error.
    try {
      sendLeadEmail_(FIELDS.map((field) => text_(params[field])));
    } catch (mailErr) {
      console.error('Lead saved, but the email failed: ' + mailErr);
    }

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

// Run once from the editor to grant email permission and check delivery. Does not add a row.
function sendTestEmail() {
  sendLeadEmail_(['Test lead', 'test@example.com', 'example.com', 'Pilot', 'This is a test email from the website contact form script.']);
}

function sendLeadEmail_(lead) {
  const [name, email, website, pkg, message] = lead;
  const rows = [
    ['Name', name],
    ['Email', email],
    ['Brand / website', website],
    ['Interested in', pkg],
    ['Message', message],
  ];
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, 80);

  const subject = 'New website lead: ' + oneLine(name) + (pkg ? ' (' + oneLine(pkg) + ')' : '');
  const body = rows.map(([label, value]) => label + ': ' + (value || '-')).join('\n') +
    '\n\nAll leads: ' + sheetUrl;
  const htmlBody =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">' +
    '<p style="margin:0 0 12px">New enquiry from the website contact form:</p>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows.map(([label, value]) =>
      '<tr><td style="color:#666;vertical-align:top;white-space:nowrap">' + label + '</td>' +
      '<td style="white-space:pre-wrap">' + escapeHtml_(value || '-') + '</td></tr>').join('') +
    '</table>' +
    '<p style="margin:16px 0 0"><a href="' + sheetUrl + '">Open all leads in Google Sheets</a></p>' +
    '</div>';

  const options = { name: 'TIC Website', htmlBody: htmlBody };
  // "Reply" in your inbox goes straight to the person who filled in the form
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) options.replyTo = email;

  MailApp.sendEmail(NOTIFY_EMAIL, subject, body, options);
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

function text_(value) {
  return String(value || '').trim().slice(0, MAX_LENGTH);
}

function clean_(value) {
  const text = text_(value);
  // stop values like "=HYPERLINK(...)" from running as formulas in the sheet
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
