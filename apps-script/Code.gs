// Jamo's Ski & Snowboard Repair: receives booking and photo requests from the website.
// Each request becomes a row on the "Requests" tab, photos are saved to a Drive folder,
// and an alert is emailed to the Google account that owns this sheet. The email address
// never appears on the website.

var SHEET_NAME = "Requests";
var FOLDER_NAME = "Jamo's Repair Photos";
var HEADERS = ["Received", "Type", "Name", "Phone", "Day", "Time", "Drop-off / Pickup", "Pickup address", "Order", "Estimated total", "Notes", "Photos", "Status"];

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

// Lets you open the web app URL in a browser to check it's running.
function doGet() {
  return reply_({ ok: true, message: "Jamo's request inbox is running." });
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
  }
  return sheet;
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
