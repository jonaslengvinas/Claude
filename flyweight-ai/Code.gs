/**
 * Code.gs — Flyweight AI dydžių konsultacijos imtuvas (SAVARANKIŠKAS).
 *
 * Atskiras projektas nuo Omniva paštomatų — nieko bendro su jais neturi.
 * Vienas failas, įkeliamas į Apps Script, susietą su AI dydžių Google lentele.
 *
 * Ką daro:
 *   doPost  : priima Flyweight dydžių konsultacijos santrauką (JSON webhook'as)
 *             ir įrašo vieną eilutę į lapą „Konsultacijos".
 *   doGet   : trumpas statusas (patikrinti, ar Web App gyvas).
 *
 * Saugumas: Apps Script Web App nemato HTTP antraščių, todėl naudojam slaptą
 *   ?token=... URL'e (kaip ir kituose Apps Script webhook'uose).
 *
 * Laukiamas JSON (visi neprivalomi, išskyrus bent vieną iš order_number/email):
 *   {
 *     "action": "size_review",
 *     "order_number":     "#1234",
 *     "customer_email":   "klientas@pastas.lt",
 *     "product_type":     "T-shirt",
 *     "gender":           "male",
 *     "height":           "182 cm",
 *     "chest":            "104 cm",
 *     "weight":           "95 kg",
 *     "body_shape_notes": "platesnis liemuo",
 *     "fit_preference":   "regular",
 *     "recommended_size": "XL",
 *     "alternative_size": "L",
 *     "ai_reason":        "XL plotis 59.5 cm, L plotis 56.5 cm.",
 *     "chat_summary":     "..."
 *   }
 */

// ─────────────────────────────────────────────────────────────────────────
// NUSTATYMAI
// ─────────────────────────────────────────────────────────────────────────

var SHEET_NAME = 'Konsultacijos';
var AI_STATUS = 'PATIKRINTI DYDĮ';

/** Webhook token laikomas Script Properties (Project Settings → Script Properties).
 *  Raktas: WEBHOOK_TOKEN. Sugeneruoti gali paleidęs generateWebhookToken(). */
function _token() {
  return PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN') || '';
}

/** Stulpelių antraštės (vienas konsultacijos įrašas = viena eilutė). */
var HEADERS = [
  'Laikas', 'Užsakymas', 'El. paštas', 'Prekė', 'Lytis',
  'Ūgis', 'Krūtinė', 'Svoris', 'Kūno forma', 'Fit',
  'Rekomenduota', 'Alternatyva', 'Priežastis', 'Pokalbio santrauka',
  'AI statusas',
];

/** JSON lauko raktas pagal antraštę. */
var FIELD = {
  'Laikas': '_time',
  'Užsakymas': 'order_number',
  'El. paštas': 'customer_email',
  'Prekė': 'product_type',
  'Lytis': 'gender',
  'Ūgis': 'height',
  'Krūtinė': 'chest',
  'Svoris': 'weight',
  'Kūno forma': 'body_shape_notes',
  'Fit': 'fit_preference',
  'Rekomenduota': 'recommended_size',
  'Alternatyva': 'alternative_size',
  'Priežastis': 'ai_reason',
  'Pokalbio santrauka': 'chat_summary',
  'AI statusas': '_status',
};

// ─────────────────────────────────────────────────────────────────────────
// ĮĖJIMO TAŠKAI
// ─────────────────────────────────────────────────────────────────────────

function doGet() {
  return _json({ ok: true, service: 'Flyweight AI dydžių imtuvas', sheet: SHEET_NAME });
}

function doPost(e) {
  // 1. Token apsauga.
  var token = (e && e.parameter && e.parameter.token) || '';
  if (!_token() || token !== _token()) {
    return _json({ ok: false, error: 'neteisingas arba trūkstamas token' });
  }

  // 2. JSON.
  var p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return _json({ ok: false, error: 'blogas JSON' });
  }

  return _json(handleSizeReview(p));
}

// ─────────────────────────────────────────────────────────────────────────
// LOGIKA
// ─────────────────────────────────────────────────────────────────────────

/** Įrašo vieną dydžių konsultaciją į lentelę. Grąžina {ok, row}. */
function handleSizeReview(p) {
  p = p || {};
  var order = String(p.order_number || '').trim();
  var email = String(p.customer_email || '').trim();
  if (!order && !email) {
    return { ok: false, error: 'reikia bent order_number arba customer_email' };
  }

  var s = _sheet();
  var row = HEADERS.map(function (h) {
    var key = FIELD[h];
    if (key === '_time') return new Date();
    if (key === '_status') return AI_STATUS;
    return p[key] != null ? String(p[key]) : '';
  });
  s.appendRow(row);

  return { ok: true, order: order, email: email, status: AI_STATUS, row: s.getLastRow() };
}

// ─────────────────────────────────────────────────────────────────────────
// LENTELĖ
// ─────────────────────────────────────────────────────────────────────────

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Apps Script nesusietas su Google lentele. Atidaryk per Sheets → Extensions → Apps Script.');
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

/** Paruošia / atnaujina antraštes (paleisk vieną kartą). */
function setupSheet() {
  _writeHeaders(_sheet());
  try { SpreadsheetApp.getUi().alert('Lentelė paruošta ✅ Stulpelių: ' + HEADERS.length); } catch (e) {}
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// PAGALBINĖS
// ─────────────────────────────────────────────────────────────────────────

/** Sugeneruoja ir įrašo webhook token'ą. Paleisk vieną kartą, nukopijuok iš Logs. */
function generateWebhookToken() {
  var t = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('WEBHOOK_TOKEN', t);
  Logger.log('WEBHOOK_TOKEN = ' + t);
  return t;
}

/** Rankinis testas (Run → testSizeReview). Įrašo bandomąją eilutę. */
function testSizeReview() {
  var res = handleSizeReview({
    action: 'size_review',
    order_number: '#TEST-SIZE',
    customer_email: 'testas@pastas.lt',
    product_type: 'T-shirt',
    gender: 'male',
    height: '182 cm',
    chest: '104 cm',
    weight: '95 kg',
    body_shape_notes: 'platesnis liemuo',
    fit_preference: 'regular',
    recommended_size: 'XL',
    alternative_size: 'L',
    ai_reason: 'XL plotis 59.5 cm, L plotis 56.5 cm.',
    chat_summary: 'Klientas dvejojo tarp L ir XL.',
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}
