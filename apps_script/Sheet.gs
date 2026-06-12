/**
 * Sheet.gs — Google Sheets kaip duomenų bazė, statusų lenta ir valdymas.
 *
 * Lapas "Orders" — viena eilutė vienam užsakymui. Stulpeliai suskirstyti grupėmis:
 *   A) Užsakymo info (iš Shopify)        — Laikas … Adresas
 *   B) Siuntos duomenys (programa)       — Pastomatas … Lipdukas
 *   C) Statusai (✅/❌)                   — Siunta sukurta / Lipdukas / Fulfilled / Būsena
 *   D) Pakeisti pastomatą (rankinis)     — Naujas pastomatas / Patvirtinti / Rezultatas
 *   E) Grąžinimai ir pastabos            — Grąžinta / Pastabos
 *   F) Techninis                         — OrderID
 */

var SHEET_NAME = 'Orders';

var HEADERS = [
  // A) Užsakymo info
  'Laikas', 'Užsakymas', 'Klientas', 'El. paštas', 'Telefonas', 'Šalis', 'Adresas',
  // B) Siuntos duomenys
  'Pastomatas', 'Pastomato ID', 'km', '3 artimiausi', 'Tracking', 'Lipdukas',
  // C) Statusai
  'Siunta sukurta', 'Lipdukas sukurtas', 'Fulfilled Shopify', 'Būsena',
  // D) Veiksmai eilutėje (rankiniai)
  'Naujas pastomatas', 'Patvirtinti (OK)', 'Sukurti grąžinimą (OK)', 'Veiksmo rezultatas',
  // E) Grąžinimai / pastabos
  'Grąžinta', 'Pastabos',
  // F) Techninis
  'OrderID',
];

/** Stulpelio (rec lauko) raktas pagal antraštę. */
var HEADER_KEY = {
  'Laikas': 'time', 'Užsakymas': 'order', 'Klientas': 'customer', 'El. paštas': 'email',
  'Telefonas': 'phone', 'Šalis': 'country', 'Adresas': 'address',
  'Pastomatas': 'locker', 'Pastomato ID': 'lockerId', 'km': 'km', '3 artimiausi': 'alt',
  'Tracking': 'tracking', 'Lipdukas': 'label',
  'Siunta sukurta': 'shipmentOk', 'Lipdukas sukurtas': 'labelOk', 'Fulfilled Shopify': 'fulfilledOk',
  'Būsena': 'status',
  'Naujas pastomatas': 'newLocker', 'Patvirtinti (OK)': 'confirm',
  'Sukurti grąžinimą (OK)': 'makeReturn', 'Veiksmo rezultatas': 'changeResult',
  'Grąžinta': 'returned', 'Pastabos': 'notes', 'OrderID': 'orderId',
};

/** Stulpelio numeris (1-based) pagal antraštę. */
function _col(name) {
  return HEADERS.indexOf(name) + 1;
}

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Apps Script nesusietas su Google lentele. Sukurk per Sheets → Extensions → Apps Script.');
  var s = ss.getSheetByName(SHEET_NAME);
  if (!s) {
    s = ss.insertSheet(SHEET_NAME);
    _writeHeaders(s);
  }
  return s;
}

function _writeHeaders(s) {
  s.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  s.setFrozenRows(1);
}

/** Paruošia / atnaujina lentelės stulpelius (kviečiama iš meniu). */
function setupSheet() {
  var s = _sheet();
  _writeHeaders(s);
  try { SpreadsheetApp.getUi().alert('Lentelė paruošta ✅\nStulpelių: ' + HEADERS.length); } catch (e) {}
  return true;
}

/** Eilutės numeris pagal užsakymo pavadinimą (arba 0). */
function _findRow(s, orderName) {
  var oc = _col('Užsakymas');
  var last = s.getLastRow();
  if (last < 2) return 0;
  var data = s.getRange(2, oc, last - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(orderName)) return i + 2;
  }
  return 0;
}

/**
 * Įrašo / atnaujina užsakymą. Esamoje eilutėje atnaujina TIK tuos stulpelius,
 * kuriuos rec pateikia (rankiniai laukai, pvz. "Naujas pastomatas", nedingsta).
 */
function upsertOrder(rec) {
  var s = _sheet();
  var existing = _findRow(s, rec.order);
  if (existing) {
    HEADERS.forEach(function (h, i) {
      var k = HEADER_KEY[h];
      if (k && rec.hasOwnProperty(k)) s.getRange(existing, i + 1).setValue(rec[k]);
    });
    return existing;
  }
  var row = HEADERS.map(function (h) {
    var k = HEADER_KEY[h];
    return k && rec.hasOwnProperty(k) ? rec[k] : '';
  });
  if (!rec.hasOwnProperty('time')) row[HEADERS.indexOf('Laikas')] = new Date();
  s.appendRow(row);
  return s.getLastRow();
}

/** Atnaujina būseną / pastabą (nepaliesdamas kitų laukų). */
function updateOrderStatus(orderName, status, notes) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  if (status != null) s.getRange(row, _col('Būsena')).setValue(status);
  if (notes != null) s.getRange(row, _col('Pastabos')).setValue(notes);
  return true;
}

/** Įrašo lipduko Drive nuorodą. */
function setLabelUrl(orderName, url) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  s.getRange(row, _col('Lipdukas')).setValue(url);
  s.getRange(row, _col('Lipdukas sukurtas')).setValue('✅');
  return true;
}

/** Įrašo naują tracking. */
function setTracking(orderName, barcode) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  s.getRange(row, _col('Tracking')).setValue(barcode);
  return true;
}

/** Grąžina vieno užsakymo eilutę kaip objektą (raktai = antraštės). */
function getOrder(orderName) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return null;
  var vals = s.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  var o = {};
  HEADERS.forEach(function (h, i) { o[h] = vals[i]; });
  return o;
}

/** Pažymi užsakymą kaip grąžintą. */
function markReturned(orderName, value) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  s.getRange(row, _col('Grąžinta')).setValue(value || new Date());
  return true;
}

/** Visi užsakymai dashboard'ui (naujausi viršuje). */
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
  out.reverse();
  if (limit) return out.slice(0, limit);
  return out;
}
