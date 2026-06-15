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
  'Užsakyta', 'Rekomenduota', 'Alternatyva', 'Priežastis', 'Pokalbio santrauka',
  'Pastabos', 'AI statusas',
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
  'Užsakyta': 'ordered_size',
  'Rekomenduota': 'recommended_size',
  'Alternatyva': 'alternative_size',
  'Priežastis': 'ai_reason',
  'Pokalbio santrauka': 'chat_summary',
  'Pastabos': 'notes',
  'AI statusas': '_status',
};

/** Laukai, kurie galioja PER PREKĘ (gali skirtis kiekvienai eilutei).
 *  Visi kiti laukai laikomi bendrais visam užsakymui (klientas, ūgis ir t. t.). */
var ITEM_FIELDS = ['product_type', 'ordered_size', 'recommended_size', 'alternative_size', 'ai_reason'];

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

/**
 * Įrašo dydžių konsultaciją į lentelę.
 *
 * Vienas produktas: visi laukai tiesiai payload'e -> viena eilutė.
 * Keli produktai: payload turi `items: [...]` -> PO EILUTĘ KIEKVIENAM produktui,
 *   visi su TUO PAČIU užsakymo numeriu. Bendri kliento laukai (ūgis, svoris,
 *   kūno forma ir t. t.) imami iš payload viršaus; prekės laukai — iš items[i].
 *
 * Grąžina { ok, order, count, rows }.
 */
function handleSizeReview(p) {
  p = p || {};
  var order = String(p.order_number || '').trim();
  var email = String(p.customer_email || '').trim();
  var s = _sheet();
  var now = new Date();

  // TRŪKSTA ESMINĖS INFO: vis tiek UŽREGISTRUOJAM, kad matytum, jog konsultacija
  // įvyko, bet duomenų nepakako. Eilutės nepildom — tik statusas + pastaba.
  if (!order && !email) {
    s.appendRow(_buildRow(p, null, now, 'TRŪKSTA INFO',
      p.notes || 'Nepavyko nustatyti užsakymo numerio ar el. pašto.'));
    return { ok: true, logged: true, status: 'TRŪKSTA INFO', row: s.getLastRow() };
  }

  // Statusą gali nurodyti siuntėjas (pvz. Pabbly/ChatGPT); kitu atveju numatytasis.
  var status = p.status ? String(p.status) : AI_STATUS;
  var notes = p.notes || '';

  // Vienas ar keli produktai (items[]) — po eilutę kiekvienam, tas pats užsakymo nr.
  var items = (p.items && p.items.length) ? p.items : [null];
  var rows = [];
  items.forEach(function (item) {
    s.appendRow(_buildRow(p, item, now, status, notes));
    rows.push(s.getLastRow());
  });

  return { ok: true, order: order, email: email, status: status, count: rows.length, rows: rows };
}

/** Sukuria vieną eilutę (HEADERS tvarka). item = prekės laukai (arba null). */
function _buildRow(p, item, now, status, notes) {
  return HEADERS.map(function (h) {
    var key = FIELD[h];
    if (key === '_time') return now;
    if (key === '_status') return status;
    if (key === 'notes') return notes != null ? String(notes) : '';
    // Prekės laukas: pirmiausia iš item, jei nėra — iš payload viršaus.
    if (item && item[key] != null) return String(item[key]);
    return p[key] != null ? String(p[key]) : '';
  });
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

/** Rankinis testas: VIENAS produktas (Run → testSizeReview). */
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
    ordered_size: 'L',
    recommended_size: 'XL',
    alternative_size: 'L',
    ai_reason: 'XL plotis 59.5 cm, L plotis 56.5 cm.',
    chat_summary: 'Klientas dvejojo tarp L ir XL.',
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/** Rankinis testas: KELI produktai viename užsakyme (Run → testSizeReviewMulti).
 *  Sukuria 2 eilutes su tuo pačiu užsakymo nr. #TEST-MULTI. */
function testSizeReviewMulti() {
  var res = handleSizeReview({
    action: 'size_review',
    order_number: '#TEST-MULTI',
    customer_email: 'testas@pastas.lt',
    gender: 'male',
    height: '182 cm',
    chest: '104 cm',
    weight: '95 kg',
    body_shape_notes: 'platesnis liemuo',
    fit_preference: 'regular',
    chat_summary: 'Klientas dvejojo dėl abiejų prekių.',
    items: [
      {
        product_type: 'T-shirt',
        ordered_size: 'L',
        recommended_size: 'XL',
        alternative_size: 'L',
        ai_reason: 'T-shirt: XL plotis 59.5 cm vs L 56.5 cm.',
      },
      {
        product_type: 'Sweatshirt',
        ordered_size: 'M',
        recommended_size: 'L',
        alternative_size: 'M',
        ai_reason: 'Sweatshirt: L plotis tinka liemeniui.',
      },
    ],
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/** Rankinis testas: TRŪKSTA info (Run → testSizeReviewMissing).
 *  Užregistruoja eilutę su statusu „TRŪKSTA INFO" — nieko nepildo. */
function testSizeReviewMissing() {
  var res = handleSizeReview({
    action: 'size_review',
    chat_summary: 'Klientas klausė apie dydį, bet nepateikė nei užsakymo nr., nei el. pašto.',
    notes: 'Klientas neatsakė į klausimą apie užsakymą.',
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}
