// Jamo's Ski & Snowboard Repair: receives booking and photo requests from the website.
// Each request becomes a row on the "Requests" tab, photos are saved to a Drive folder,
// and an alert is emailed to the Google account that owns this sheet. The email address
// never appears on the website.

var SHEET_NAME = "Requests";
var FOLDER_NAME = "Jamo's Repair Photos";
var HEADERS = ["Received", "Type", "Name", "Phone", "Day", "Time", "Drop-off / Pickup", "Pickup address", "Order", "Estimated total", "Notes", "Photos", "Status", "Amount paid ($)", "Paid with", "Auto-texted"];
var EXPENSE_CATEGORIES = ["Wax", "P-Tex & epoxy", "Tools", "Gas & driving", "Supplies", "Website & ads", "Other"];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    // Hidden "website" field is left empty by people and filled in by spam bots.
    if (data.website) return reply_({ ok: true });

    var photoLinks = savePhotos_(data.photos || [], data.name);
    var sheet = getSheet_();
    sheet.appendRow(cells_([
      new Date(),
      data.type === "photos" ? "Photo check" : "Booking",
      clean_(data.name),
      clean_(data.phone),
      clean_(data.day),
      clean_(data.time),
      clean_(data.method),
      clean_(data.address),
      clean_(data.order),
      clean_(data.total),
      clean_(data.notes),
      photoLinks.join("\n"),
      "New"
    ]));

    sendAlert_(data, photoLinks, sheet);
    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false, error: String(err) });
  }
}

// Opening the web app URL in a browser shows it's running.
// The iPhone auto-text shortcut calls it with ?key=... to get the next booking that
// hasn't been auto-texted yet. The key is private and is never on the website.
function doGet(e) {
  var key = PropertiesService.getScriptProperties().getProperty("AUTOTEXT_KEY");
  if (!key || !e || !e.parameter || e.parameter.key !== key) {
    return reply_({ ok: true, message: "Jamo's request inbox is running." });
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_();
    var last = sheet.getLastRow();
    if (last < 2) return reply_({ ok: true });
    var rows = sheet.getRange(2, 1, last - 1, 16).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r[1] === "Booking" && r[3] && !r[15]) {
        sheet.getRange(i + 2, 16).setValue(new Date());
        var first = String(r[2]).split(" ")[0];
        var msg = "Hi " + first + "! It's Jamo from Jamo's Ski & Snowboard Repair. Got your booking request for " +
          asDay_(r[4]) + ", " + r[5] + ":\n" + r[8] + "\nEstimated total: " + (typeof r[9] === "number" ? "$" + r[9] : r[9]) +
          "\nI'll text you soon to confirm your time.";
        return reply_({ ok: true, name: first, phone: String(r[3]), message: msg });
      }
    }
    return reply_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// Sheets can turn "Thu, Oct 22" into a date; turn it back into words for the text.
function asDay_(v) {
  return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "EEE, MMM d") : String(v);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME, 0);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#12293b").setFontColor("#ffffff");
    sheet.setColumnWidths(1, HEADERS.length, 150);
    var status = SpreadsheetApp.newDataValidation().requireValueInList(["New", "Texted", "Booked", "Done"], true).build();
    sheet.getRange("M2:M").setDataValidation(status);
    formatPaidColumns_(sheet);
  }
  return sheet;
}

// Adds a "Jamo's" menu to the sheet.
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Jamo's")
    .addItem("Set up money tracking", "setupMoneyTracking")
    .addItem("Set up auto-text", "setupAutoText")
    .addToUi();
}

// Run once. Adds "Amount paid" and "Paid with" columns to Requests, an Expenses tab,
// and a Season Totals tab that adds up money in, expenses and profit. Safe to run again.
function setupMoneyTracking() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var req = getSheet_();
  req.getRange(1, 14, 1, 2).setValues([["Amount paid ($)", "Paid with"]]).setFontWeight("bold").setBackground("#12293b").setFontColor("#ffffff");
  formatPaidColumns_(req);

  var exp = ss.getSheetByName("Expenses");
  if (!exp) {
    exp = ss.insertSheet("Expenses");
    exp.appendRow(["Date", "What", "Category", "Amount ($)", "Notes"]);
    exp.setFrozenRows(1);
    exp.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#12293b").setFontColor("#ffffff");
    exp.setColumnWidths(1, 5, 160);
    exp.getRange("A2:A").setNumberFormat("m/d/yyyy").setDataValidation(SpreadsheetApp.newDataValidation().requireDate().build());
    exp.getRange("C2:C").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(EXPENSE_CATEGORIES, true).build());
    exp.getRange("D2:D").setNumberFormat("$#,##0.00");
  }

  var tot = ss.getSheetByName("Season Totals");
  if (!tot) {
    tot = ss.insertSheet("Season Totals", 0);
    var dates = function (col) { return col + ',">="&$B$3,' + col + ',"<"&$B$4+1'; };
    var rows = [
      ["Season Totals", ""],
      ["", ""],
      ["Season start", new Date(2026, 9, 1)],
      ["Season end", new Date(2027, 4, 31)],
      ["", ""],
      ["Money in", "=SUMIFS(Requests!N:N," + dates("Requests!A:A") + ")"],
      ["Expenses", "=SUMIFS(Expenses!D:D," + dates("Expenses!A:A") + ")"],
      ["Profit", "=B6-B7"],
      ["Paid jobs", "=COUNTIFS(Requests!N:N,\">0\"," + dates("Requests!A:A") + ")"],
      ["Average per job", "=IF(B9=0,0,B6/B9)"],
      ["", ""],
      ["Expenses by category", ""]
    ];
    EXPENSE_CATEGORIES.forEach(function (c, i) {
      rows.push([c, "=SUMIFS(Expenses!D:D,Expenses!C:C,A" + (13 + i) + "," + dates("Expenses!A:A") + ")"]);
    });
    tot.getRange(1, 1, rows.length, 2).setValues(rows);
    tot.setColumnWidth(1, 200).setColumnWidth(2, 140);
    tot.getRange("A1").setFontSize(16).setFontWeight("bold");
    tot.getRange("B3:B4").setNumberFormat("m/d/yyyy").setBackground("#fff7d6");
    tot.getRange("B6:B8").setNumberFormat("$#,##0.00");
    tot.getRange("B10").setNumberFormat("$#,##0.00");
    tot.getRange(13, 2, EXPENSE_CATEGORIES.length, 1).setNumberFormat("$#,##0.00");
    tot.getRange("A8:B8").setFontWeight("bold").setFontSize(13).setBackground("#eaf3f9");
    tot.getRange("A12").setFontWeight("bold");
    tot.getRange("C3").setValue("Change these dates each season").setFontColor("#557085");
  }
  ss.setActiveSheet(tot);
}

// Run once after deploying the new version. Creates a private link for the iPhone
// shortcut and puts it on a Settings tab. Existing bookings are marked as already
// texted so customers from before don't get a surprise text.
function setupAutoText() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("AUTOTEXT_KEY");
  if (!key) { key = Utilities.getUuid().replace(/-/g, ""); props.setProperty("AUTOTEXT_KEY", key); }

  var req = getSheet_();
  req.getRange(1, 16).setValue("Auto-texted").setFontWeight("bold").setBackground("#12293b").setFontColor("#ffffff");
  var last = req.getLastRow();
  if (last >= 2) {
    var col = req.getRange(2, 16, last - 1, 1);
    var vals = col.getValues().map(function (v) { return [v[0] || "Before auto-text"]; });
    col.setValues(vals);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var set = ss.getSheetByName("Settings") || ss.insertSheet("Settings");
  set.getRange("A1:A3").setValues([["Auto-text link for the iPhone shortcut (keep this private)"], [ScriptApp.getService().getUrl() + "?key=" + key], ["If you ever need a new link, delete AUTOTEXT_KEY in Apps Script > Project Settings > Script Properties and run Set up auto-text again."]]);
  set.getRange("A1").setFontWeight("bold");
  set.setColumnWidth(1, 700);
  ss.setActiveSheet(set);
}

function formatPaidColumns_(sheet) {
  sheet.getRange("N2:N").setNumberFormat("$#,##0.00");
  sheet.getRange("O2:O").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Cash", "Venmo", "Zelle", "Other"], true).build());
}

function savePhotos_(photos, name) {
  if (!photos.length) return [];
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HHmm");
  return photos.slice(0, 5).map(function (p, i) {
    var bytes = Utilities.base64Decode(p.data);
    var blob = Utilities.newBlob(bytes, p.mime || "image/jpeg", stamp + " " + clean_(name) + " " + (i + 1) + ".jpg");
    return folder.createFile(blob).getUrl();
  });
}

function sendAlert_(data, photoLinks, sheet) {
  var kind = data.type === "photos" ? "Photo check" : "Booking";
  // Subject starts with the phone number so a phone automation can read it.
  var subject = clean_(data.phone) + " | New " + kind + " from " + clean_(data.name);
  var lines = [
    kind + " request from the website",
    "",
    "Name: " + clean_(data.name),
    "Phone: " + clean_(data.phone)
  ];
  if (data.day) lines.push("Day: " + data.day + ", " + clean_(data.time));
  if (data.method) lines.push("Drop-off / Pickup: " + clean_(data.method) + (data.address ? " at " + clean_(data.address) : ""));
  if (data.order) lines.push("", "Order:", clean_(data.order), "Estimated total: " + clean_(data.total));
  if (data.notes) lines.push("", "Notes: " + clean_(data.notes));
  if (photoLinks.length) lines.push("", "Photos:", photoLinks.join("\n"));
  lines.push("", "All requests: " + sheet.getParent().getUrl());
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, lines.join("\n"));
}

function clean_(v) {
  return v == null ? "" : String(v).slice(0, 2000);
}

// Stops text like "=..." from being treated as a spreadsheet formula.
function cells_(row) {
  return row.map(function (v) { return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v; });
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
