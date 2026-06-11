/**
 * Sheet.gs — Google Sheets kaip duomenų bazė ir eksportas.
 *
 * Lapas "Orders" laiko po vieną eilutę kiekvienam užsakymui su visa būsena.
 * Dashboard'as skaito iš čia; tai pat yra tavo eksportas (gali atsisiųsti CSV/Excel).
 */

var SHEET_NAME = 'Orders';
var HEADERS = [
  'Laikas', 'Užsakymas', 'Klientas', 'El. paštas', 'Telefonas',
  'Šalis', 'Adresas', 'Pastomatas', 'Pastomato ID', 'km',
  'Tracking', 'Būsena', 'Grąžinta', 'Pastabos',
  'Lipdukas', 'Alt pastomatai', 'OrderID',
];

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Apps Script nesusietas su Google lentele. Sukurk per Sheets → Extensions → Apps Script.');
  var s = ss.getSheetByName(SHEET_NAME);
  if (!s) {
    s = ss.insertSheet(SHEET_NAME);
    s.appendRow(HEADERS);
    s.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

/** Suranda eilutės numerį pagal užsakymo pavadinimą (arba 0). */
function _findRow(s, orderName) {
  var data = s.getRange(2, 2, Math.max(s.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(orderName)) return i + 2;
  }
  return 0;
}

/**
 * Įrašo arba atnaujina užsakymo eilutę. `rec` — objektas su laukais.
 * Jei užsakymas jau yra (pagal "Užsakymas") — atnaujina, kitaip prideda.
 */
function upsertOrder(rec) {
  var s = _sheet();
  var row = [
    rec.time || new Date(),
    rec.order || '',
    rec.customer || '',
    rec.email || '',
    rec.phone || '',
    rec.country || '',
    rec.address || '',
    rec.locker || '',
    rec.lockerId || '',
    rec.km || '',
    rec.tracking || '',
    rec.status || '',
    rec.returned || '',
    rec.notes || '',
    rec.label || '',
    rec.alt || '',
    rec.orderId || '',
  ];
  var existing = _findRow(s, rec.order);
  if (existing) {
    s.getRange(existing, 1, 1, row.length).setValues([row]);
    return existing;
  }
  s.appendRow(row);
  return s.getLastRow();
}

/** Atnaujina konkretaus užsakymo būseną/pastabą (nepaliesdamas kitų laukų). */
function updateOrderStatus(orderName, status, notes) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  if (status != null) s.getRange(row, 12).setValue(status); // Būsena
  if (notes != null) s.getRange(row, 14).setValue(notes); // Pastabos
  return true;
}

/** Įrašo lipduko Drive nuorodą (stulpelis "Lipdukas" = 15). */
function setLabelUrl(orderName, url) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  s.getRange(row, 15).setValue(url);
  return true;
}

/** Įrašo naują tracking (stulpelis 11) ir būseną — naudojama perdarant. */
function setTracking(orderName, barcode) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  s.getRange(row, 11).setValue(barcode);
  return true;
}

/** Grąžina vieno užsakymo eilutę kaip objektą (ui veiksmams). */
function getOrder(orderName) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return null;
  var vals = s.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  var o = {};
  HEADERS.forEach(function (h, i) { o[h] = vals[i]; });
  return o;
}

/** Pažymi užsakymą kaip grąžintą (grąžinimų skiltis). */
function markReturned(orderName, value) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  s.getRange(row, 13).setValue(value || new Date()); // Grąžinta
  return true;
}

/** Grąžina visus užsakymus dashboard'ui (naujausi viršuje). */
function listOrders(limit) {
  var s = _sheet();
  var last = s.getLastRow();
  if (last < 2) return [];
  var values = s.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = values.map(function (r) {
    var o = {};
    HEADERS.forEach(function (h, i) {
      o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : r[i];
    });
    return o;
  });
  out.reverse(); // naujausi viršuje
  if (limit) return out.slice(0, limit);
  return out;
}
