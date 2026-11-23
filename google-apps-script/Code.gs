/**
 * Website forms → Google Sheet + email
 *
 * Handles two forms from the website:
 *  - Contact form (contact.html)            → "Leads" tab
 *  - Reddit user form (reddit-user-form.html) → "Reddit Users" tab
 * Each submission becomes a new row in its tab, and a copy is emailed to NOTIFY_EMAIL.
 * The form says which one it is with a hidden field "form" (no field = contact form).
 *
 * Setup:
 *  1. Create a Google Sheet, then open Extensions → Apps Script.
 *  2. Replace the editor's code with this whole file and save.
 *  3. Select the function "sendTestEmail" at the top and click Run once.
 *     Allow the permissions Google asks for (it needs "send email as you").
 *     Check that the test email arrives.
 *  4. Deploy → New deployment → type "Web app".
 *     Execute as: Me. Who has access: Anyone. Deploy and allow access.
 *  5. Copy the Web app URL (ends with /exec) into the website forms' action="…".
 *
 * After editing this script later: Deploy → Manage deployments → Edit →
 * Version "New version" → Deploy. Otherwise the URL keeps running the old code.
 */

// New submissions are emailed here. Separate several addresses with commas.
const NOTIFY_EMAIL = 'ankit65604@gmail.com';
const MAX_LENGTH = 3000;

const FORMS = {
  contact: {
    sheet: 'Leads',
    // [column header, form field name]
    columns: [['Name', 'name'], ['Email', 'email'], ['Website', 'website'], ['Package', 'package'], ['Message', 'message']],
    required: ['name', 'email', 'message'],
    subject: (d) => 'New website lead: ' + d.name + (d.package ? ' (' + d.package + ')' : ''),
    intro: 'New enquiry from the website contact form:',
  },
  'reddit-user': {
    sheet: 'Reddit Users',
    columns: [['Name', 'name'], ['Reddit profile', 'reddit'], ['Phone', 'phone'], ['Email', 'email'],
      ['Social platform', 'social'], ['Social link', 'social_link']],
    required: ['name', 'reddit', 'phone', 'email'],
    subject: (d) => 'New Reddit user form: ' + d.name,
    intro: 'New submission from the Reddit user form:',
  },
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const params = (e && e.parameter) || {};

    // spam trap: real visitors never fill this hidden field
    if (params.company_hp) return json_({ result: 'success' });

    const form = FORMS[params.form] || FORMS.contact;
    const data = {};
    form.columns.forEach(([, field]) => { data[field] = text_(params[field]); });

    if (form.required.some((field) => !data[field])) {
      return json_({ result: 'error', error: 'Missing required fields' });
    }

    getSheet_(form).appendRow([new Date()].concat(form.columns.map(([, field]) => safeCell_(data[field]))));

    // The row is already saved, so a mail problem (e.g. daily quota) must not show the visitor an error.
    try {
      sendEmail_(form, data);
    } catch (mailErr) {
      console.error('Row saved, but the email failed: ' + mailErr);
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
  sendEmail_(FORMS.contact, {
    name: 'Test lead', email: 'test@example.com', website: 'example.com', package: 'Pilot',
    message: 'This is a test email from the website forms script.',
  });
}

function sendEmail_(form, data) {
  const rows = form.columns.map(([label, field]) => [label, data[field]]);
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, 80);
  const flat = {};
  Object.keys(data).forEach((k) => { flat[k] = oneLine(data[k]); });

  const subject = form.subject(flat);
  const body = form.intro + '\n\n' +
    rows.map(([label, value]) => label + ': ' + (value || '-')).join('\n') +
    '\n\nAll submissions: ' + sheetUrl;
  const htmlBody =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">' +
    '<p style="margin:0 0 12px">' + escapeHtml_(form.intro) + '</p>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows.map(([label, value]) =>
      '<tr><td style="color:#666;vertical-align:top;white-space:nowrap">' + escapeHtml_(label) + '</td>' +
      '<td style="white-space:pre-wrap">' + escapeHtml_(value || '-') + '</td></tr>').join('') +
    '</table>' +
    '<p style="margin:16px 0 0"><a href="' + sheetUrl + '">Open the Google Sheet</a> (tab: ' + escapeHtml_(form.sheet) + ')</p>' +
    '</div>';

  const options = { name: 'TIC Website', htmlBody: htmlBody };
  // "Reply" in your inbox goes straight to the person who filled in the form
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) options.replyTo = data.email;

  MailApp.sendEmail(NOTIFY_EMAIL, subject, body, options);
}

function getSheet_(form) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(form.sheet) || spreadsheet.insertSheet(form.sheet);
  if (sheet.getLastRow() === 0) {
    const headers = ['Timestamp'].concat(form.columns.map(([label]) => label));
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function text_(value) {
  return String(value || '').trim().slice(0, MAX_LENGTH);
}

// stop values like "=HYPERLINK(...)" (or a phone number starting with "+") from running as formulas
function safeCell_(text) {
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
