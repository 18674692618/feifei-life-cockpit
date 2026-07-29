const SHEET_NAME = "feifei_life_cockpit";

function doGet(event) {
  const sheet = getDataSheet();
  const raw = sheet.getRange("B2").getValue();
  return dataResponse(raw ? JSON.parse(raw) : {}, event.parameter.callback);
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const sheet = getDataSheet();
  sheet.getRange("A1:B2").setValues([
    ["savedAt", "payload"],
    [payload.savedAt || new Date().toISOString(), JSON.stringify(payload)]
  ]);
  return dataResponse({ ok: true, savedAt: payload.savedAt || new Date().toISOString() });
}

function getDataSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  return sheet;
}

function dataResponse(data, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
