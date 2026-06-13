/**
 * Config.gs — visi nustatymai vienoje vietoje.
 *
 * Slapti raktai laikomi Apps Script "Script Properties" (Project Settings →
 * Script Properties), NE kode. Dashboard'o "Nustatymai" skiltis juos užpildo.
 *
 * Kodėl token'as, o ne HMAC? Apps Script Web App doPost() NEMATO HTTP antraščių,
 * todėl Shopify X-Shopify-Hmac-Sha256 patikrinti negalim. Vietoj to webhook'o
 * URL'e įdedam slaptą token'ą (?token=...), kurį Shopify visada nusiunčia, o mes
 * perskaitom iš e.parameter. Praktinis ir saugus sprendimas šitai platformai.
 */

/** Visi nustatymų raktai + ar jie slapti (slaptų reikšmės dashboard'e užmaskuojamos). */
var SETTINGS_KEYS = [
  // Veikimo režimas
  { key: 'MODE', label: 'Režimas (TEST / LIVE)', secret: false, group: 'Bendra' },

  // Shopify
  { key: 'SHOPIFY_SHOP', label: 'Shopify domenas (pvz. mano-parduotuve.myshopify.com)', secret: false, group: 'Shopify' },
  { key: 'SHOPIFY_CLIENT_ID', label: 'Shopify Client ID (Dev Dashboard → Settings → Credentials)', secret: false, group: 'Shopify' },
  { key: 'SHOPIFY_CLIENT_SECRET', label: 'Shopify Client Secret (shpss_…) — token gaunamas automatiškai (24 val.)', secret: true, group: 'Shopify' },
  { key: 'SHOPIFY_ADMIN_TOKEN', label: 'Shopify Admin API token (NEBŪTINA — palik tuščią, jei įvesti Client ID/Secret)', secret: true, group: 'Shopify' },
  { key: 'WEBHOOK_TOKEN', label: 'Webhook slaptas token (sugeneruok mygtuku)', secret: true, group: 'Shopify' },
  { key: 'NOTIFY_CUSTOMER', label: 'Ar Shopify pats siunčia laišką? (false = palieka Print Order Pro)', secret: false, group: 'Shopify' },
  { key: 'LOCKER_NOTE_FIELD', label: 'Užsakymo lauko pavadinimas pastomatui (note_attribute)', secret: false, group: 'Shopify' },

  // Omniva OMX API
  { key: 'OMNIVA_USERNAME', label: 'Omniva API vartotojas', secret: true, group: 'Omniva' },
  { key: 'OMNIVA_PASSWORD', label: 'Omniva API slaptažodis', secret: true, group: 'Omniva' },
  { key: 'OMNIVA_CUSTOMER_CODE', label: 'Omniva customerCode (partnerio kodas)', secret: false, group: 'Omniva' },
  { key: 'OMNIVA_AGENT_ID', label: 'Omniva X-Integration-Agent-Id (jei turi)', secret: false, group: 'Omniva' },
  { key: 'TRACKING_URL_TEMPLATE', label: 'Tracking nuorodos šablonas ({barcode})', secret: false, group: 'Omniva' },

  // Lipdukai / Drive
  { key: 'DRIVE_FOLDER_ID', label: 'Google Drive aplanko ID lipdukams (iš aplanko URL)', secret: false, group: 'Lipdukai' },
  { key: 'DRIVE_FOLDER', label: 'ARBA aplanko pavadinimas (jei ID nenurodytas)', secret: false, group: 'Lipdukai' },
  { key: 'LABEL_TO_EMAIL', label: 'Lipduką siųsti el. paštu (palik tuščią = saugot į Drive)', secret: false, group: 'Lipdukai' },
  { key: 'RETURN_DAYS', label: 'Grąžinimo terminas dienomis (pvz. 14)', secret: false, group: 'Lipdukai' },

  // Siuntėjo (tavo) adresas — Omniva to reikalauja siuntai
  { key: 'SENDER_NAME', label: 'Siuntėjo vardas / įmonė', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_PHONE', label: 'Siuntėjo telefonas (su šalies prefiksu, pvz. +37060000000)', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_EMAIL', label: 'Siuntėjo el. paštas', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_STREET', label: 'Siuntėjo gatvė', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_CITY', label: 'Siuntėjo miestas', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_POSTCODE', label: 'Siuntėjo pašto kodas', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_COUNTRY', label: 'Siuntėjo šalis (LT / LV / EE)', secret: false, group: 'Siuntėjas' },
  { key: 'RETURN_LOCKER', label: 'Grąžinimo pastomatas — kur grįžta prekės (Jonažolių; pavadinimas arba ID)', secret: false, group: 'Siuntėjas' },
];

/** Numatytosios reikšmės (jei Script Property dar neįrašyta). */
var DEFAULTS = {
  MODE: 'TEST',
  NOTIFY_CUSTOMER: 'false',
  LOCKER_NOTE_FIELD: 'Paštomatas',
  TRACKING_URL_TEMPLATE: 'https://www.omniva.lt/siuntos-sekimas/?barcode={barcode}',
  SENDER_COUNTRY: 'LT',
  DRIVE_FOLDER: 'Omniva lipdukai',
  DRIVE_FOLDER_ID: '1J_D_TfO0I7VOCFAHPTV_AMI9bwSqnr5L', // "Lipdukai siuntimui"
  RETURN_DAYS: '14',
};

function _props() {
  return PropertiesService.getScriptProperties();
}

/** Vienas nustatymas (su numatytąja reikšme jei tuščia). */
function cfg(key) {
  var v = _props().getProperty(key);
  if (v === null || v === '') return DEFAULTS.hasOwnProperty(key) ? DEFAULTS[key] : '';
  return v;
}

/** Ar dirbam LIVE režime? */
function isLive() {
  return String(cfg('MODE')).toUpperCase() === 'LIVE';
}

/** Ar yra visi Omniva raktai, kad galėtume kurti realią siuntą? */
function omnivaReady() {
  return !!(cfg('OMNIVA_USERNAME') && cfg('OMNIVA_PASSWORD') && cfg('OMNIVA_CUSTOMER_CODE'));
}

/** Ar yra Shopify raktai (statinis token ARBA Client ID+Secret automatiniam token'ui)? */
function shopifyReady() {
  return !!(cfg('SHOPIFY_SHOP') && (cfg('SHOPIFY_ADMIN_TOKEN') ||
    (cfg('SHOPIFY_CLIENT_ID') && cfg('SHOPIFY_CLIENT_SECRET'))));
}

/** Įrašyti nustatymą (kviečiama iš dashboard'o). */
function saveSetting(key, value) {
  _props().setProperty(key, value);
  return true;
}

/** Įrašyti kelis nustatymus iš dashboard'o formos. */
function saveSettings(obj) {
  var p = _props();
  Object.keys(obj).forEach(function (k) {
    if (obj[k] !== '__UNCHANGED__') p.setProperty(k, obj[k]);
  });
  return true;
}

/** Grąžina nustatymus dashboard'ui (slaptus užmaskuoja). */
function getSettingsForUi() {
  var p = _props();
  return SETTINGS_KEYS.map(function (s) {
    var raw = p.getProperty(s.key);
    var val;
    if (s.secret) {
      val = raw ? '••••••••' : ''; // niekada nerodom slaptų reikšmių
    } else {
      val = raw === null ? (DEFAULTS[s.key] || '') : raw;
    }
    return { key: s.key, label: s.label, group: s.group, secret: s.secret, value: val, isSet: !!raw };
  });
}

/** Sugeneruoja atsitiktinį webhook token'ą ir įrašo. Grąžina jį dashboard'ui. */
function generateWebhookToken() {
  var token = Utilities.getUuid().replace(/-/g, '');
  _props().setProperty('WEBHOOK_TOKEN', token);
  return token;
}
/**
 * Lockers.gs — artimiausio Omniva pastomato parinkimas (LT / LV / EE).
 *
 * Adresas → koordinatės (Nominatim, nemokamai) → artimiausi pastomatai pagal
 * tiesų atstumą (haversine). Pastomatų sąrašas talpykloje 6 val.
 *
 * Svarbu: locker.id == Omniva offloadPostcode (būtent jo reikia siuntai sukurti).
 */

// Pirma bandom gyvą Omniva šaltinį (pilnas, šviežias), tada GitHub veidrodį.
var LOCKERS_URLS = [
  'https://www.omniva.lt/locations.json',
  'https://raw.githubusercontent.com/mijora/omniva-prestahop-1.7/master/locations.json',
];
var COUNTRIES = ['LT', 'LV', 'EE'];

/** Adresas -> artimiausi pastomatai. */
function findNearest(country, query, limit) {
  country = (country || '').toUpperCase();
  if (COUNTRIES.indexOf(country) < 0) return { error: 'nepalaikoma šalis: ' + country };

  var coords = geocode(query, country);
  if (!coords) return { error: 'nepavyko nustatyti koordinačių', query: query };

  var lockers = getLockers(country);
  lockers.forEach(function (l) {
    l.distance_km = round2(haversine(coords.lat, coords.lon, l.lat, l.lon));
  });
  lockers.sort(function (x, y) {
    return x.distance_km - y.distance_km;
  });
  return { geocode: coords, lockers: lockers.slice(0, limit || 3) };
}

/** Surasti pastomatą pagal ID (kai klientas pats pasirinko checkout'e). */
function lockerById(country, id) {
  if (!id) return null;
  var lockers = getLockers((country || '').toUpperCase());
  for (var i = 0; i < lockers.length; i++) {
    if (String(lockers[i].id) === String(id)) return lockers[i];
  }
  return null;
}

/** Normalizuoja tekstą paieškai: be diakritikų, mažosiomis. „Jonažolių" -> „jonazoliu". */
function _norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Ar pastomatas atitinka paiešką (pagal ATSKIRUS žodžius, be diakritikų). */
function lockerMatchesQuery(locker, query) {
  var hay = _norm(locker.name + ' ' + (locker.city || '') + ' ' + (locker.address || ''));
  var toks = _norm(query).split(/\s+/).filter(Boolean);
  if (!toks.length) return false;
  for (var i = 0; i < toks.length; i++) {
    if (hay.indexOf(toks[i]) < 0) return false;
  }
  return true;
}

/** Surasti pastomatą pagal pavadinimą (be diakritikų, pagal žodžius). */
function lockerByName(country, name) {
  if (!name) return null;
  var lockers = getLockers((country || '').toUpperCase());
  var qn = _norm(name).trim();
  if (!qn) return null;
  for (var i = 0; i < lockers.length; i++) {
    if (_norm(lockers[i].name).trim() === qn) return lockers[i]; // tikslus
  }
  for (var j = 0; j < lockers.length; j++) {
    if (lockerMatchesQuery(lockers[j], name)) return lockers[j]; // pagal žodžius
  }
  return null;
}

/**
 * Adresas -> {lat, lon}. Pirma per ĮMONTUOTĄ Apps Script Google geokoderį
 * (be API rakto, patikimas), atsarginis variantas — Nominatim.
 */
function geocode(query, country) {
  // 1) Google geokoderis (Maps servisas — be rakto)
  try {
    var g = Maps.newGeocoder();
    if (country) g.setRegion(country.toLowerCase());
    var r = g.geocode(query);
    if (r && r.status === 'OK' && r.results && r.results.length) {
      var loc = r.results[0].geometry.location;
      return { lat: loc.lat, lon: loc.lng };
    }
  } catch (e) { /* krentam į atsarginį */ }

  // 2) Atsarginis: Nominatim (OpenStreetMap)
  try {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=' +
      country.toLowerCase() + '&q=' + encodeURIComponent(query);
    var resp = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'omnibox-locker-finder/1.0 (Omniva app)' },
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      if (data && data.length) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e2) {}
  return null;
}

/** Pastomatai vienai šaliai (parsiunčiama ir laikoma talpykloje 6 val.). */
function getLockers(country) {
  var cache = CacheService.getScriptCache();
  var key = 'lockers_v2_' + country; // v2: priverstinai atnaujinam (senas cache galėjo turėti dalinį sąrašą)
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  var raw = fetchLockersRaw();
  var out = [];
  raw.forEach(function (r) {
    if (r.A0_NAME !== country) return;
    if (String(r.TYPE) !== '0') return; // 0 = pastomatas, 1 = paštas
    var lon = parseFloat(r.X_COORDINATE),
      lat = parseFloat(r.Y_COORDINATE);
    if (isNaN(lat) || isNaN(lon)) return;
    var street = [r.A5_NAME, r.A7_NAME]
      .filter(function (x) {
        return x && x !== 'NULL';
      })
      .join(' ');
    var city = r.A3_NAME && r.A3_NAME !== 'NULL' ? r.A3_NAME : r.A2_NAME || '';
    out.push({
      id: r.ZIP, // == Omniva offloadPostcode
      name: r.NAME,
      country: r.A0_NAME,
      city: city,
      address: [street, city].filter(Boolean).join(', '),
      lat: lat,
      lon: lon,
    });
  });
  cache.put(key, JSON.stringify(out), 21600); // 6 val.
  return out;
}

/**
 * Parsisiunčia pastomatų sąrašą. SVARBU: omniva.lt sąrašas yra PILNAS (~300+ LT
 * pastomatų), o GitHub veidrodis — pasenęs (~150, be naujų). Todėl:
 *   1) kvietimas su User-Agent (be jo serveris gali atmesti -> kristume į veidrodį);
 *   2) PILNUMO patikra — jei šaltinis duoda per mažai LT pastomatų, jis dalinis,
 *      bandom kitą; tik kraštutiniu atveju grąžinam ką turim.
 */
function fetchLockersRaw() {
  var opts = { muteHttpExceptions: true, followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Omnibox/1.0; +omniva)' } };
  var fallback = null;
  for (var i = 0; i < LOCKERS_URLS.length; i++) {
    try {
      var resp = UrlFetchApp.fetch(LOCKERS_URLS[i], opts);
      if (resp.getResponseCode() !== 200) continue;
      var arr = JSON.parse(resp.getContentText());
      if (!arr || !arr.length) continue;
      var ltMachines = 0;
      for (var k = 0; k < arr.length; k++) {
        if (arr[k].A0_NAME === 'LT' && String(arr[k].TYPE) === '0') ltMachines++;
      }
      if (ltMachines >= 200) return arr;     // pilnas, šviežias sąrašas
      if (!fallback) fallback = arr;          // dalinis — pasiliekam atsargai
    } catch (e) { /* bandom kitą */ }
  }
  if (fallback) return fallback;              // geriau dalinis nei nieko
  throw new Error('Nepavyko parsisiųsti pastomatų sąrašo nė iš vieno šaltinio.');
}

/** Atstumas tarp dviejų taškų (km). */
function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371.0088;
  var toRad = function (d) {
    return (d * Math.PI) / 180;
  };
  var dLat = toRad(lat2 - lat1),
    dLon = toRad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
/**
 * Omniva.gs — Omniva OMX API klientas (Apps Script versija).
 *
 * Pagrindinis srautas:
 *   registerShipment(order, locker)  -> sukuria B2C siuntą, grąžina barcode (tracking)
 *   requestLabel(barcodes)           -> gauna lipduko PDF (base64) arba siunčia el. paštu
 *   trackShipment(barcode)           -> siuntos būsenos įvykiai
 *
 * locker.id == offloadPostcode — būtent jį Omniva naudoja maršrutui į pastomatą.
 */

var OMNIVA_BASES = {
  test: 'https://test-omx.omniva.eu/api/v01/omx',
  live: 'https://omx.omniva.eu/api/v01/omx',
};

// Kai true — Omniva kvietimai EINA Į TEST aplinką, net jei MODE=LIVE.
// Naudojama testams/patikrai, kad NIEKADA nesukurtų realios siuntos.
var _forceTestOmniva = false;

function omnivaBase() {
  return (isLive() && !_forceTestOmniva) ? OMNIVA_BASES.live : OMNIVA_BASES.test;
}

/** Basic Auth antraštės. */
function omnivaHeaders() {
  if (!omnivaReady()) {
    throw new Error('Trūksta Omniva raktų (OMNIVA_USERNAME / PASSWORD / CUSTOMER_CODE).');
  }
  var token = Utilities.base64Encode(cfg('OMNIVA_USERNAME') + ':' + cfg('OMNIVA_PASSWORD'));
  var headers = { Authorization: 'Basic ' + token };
  if (cfg('OMNIVA_AGENT_ID')) headers['X-Integration-Agent-Id'] = cfg('OMNIVA_AGENT_ID');
  return headers;
}

/** Bendras POST į Omniva su Basic Auth. */
function omnivaPost(path, body) {
  var resp = UrlFetchApp.fetch(omnivaBase() + path, {
    method: 'post',
    contentType: 'application/json',
    headers: omnivaHeaders(),
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  return omnivaParse(resp);
}

/** Bendras GET į Omniva (sekimo užklausoms). */
function omnivaGet(path) {
  var resp = UrlFetchApp.fetch(omnivaBase() + path, {
    method: 'get',
    headers: omnivaHeaders(),
    muteHttpExceptions: true,
  });
  return omnivaParse(resp);
}

function omnivaParse(resp) {
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Omniva: ' + omnivaErrorMessage(text, code));
  }
  return text ? JSON.parse(text) : {};
}

/** Iš Omniva JSON klaidos ištraukia žmogui suprantamą žinutę (be techninių šiukšlių). */
function omnivaErrorMessage(text, code) {
  try {
    var j = JSON.parse(text);
    if (j.errors) {
      var msgs = [];
      Object.keys(j.errors).forEach(function (k) {
        (j.errors[k] || []).forEach(function (e) { msgs.push(k + ': ' + (e.message || e.code)); });
      });
      if (msgs.length) return msgs.join('; ');
    }
    if (j.details) return j.details;
    if (j.message) return j.message;
    if (j.error) return j.error;
  } catch (e) {}
  return 'klaida (' + code + ')';
}

/** Vardas + užsakymo nr (kad lipduke matytųsi iškart po vardo). Maks. 50 simb. */
function nameWithOrder(name, orderNo) {
  var s = orderNo ? (name + '  ' + orderNo) : String(name || '');
  return s.length > 50 ? s.slice(0, 50) : s;
}

/** Sukuria B2C siuntą į pastomatą. Grąžina { barcode, raw }. */
function registerShipment(order, locker) {
  var receiver = {
    personName: nameWithOrder(order.name, order.partner_shipment_id),
    address: {
      country: order.country,
      offloadPostcode: String(locker.id), // <-- pastomatas
    },
  };
  if (order.phone) receiver.contactMobile = order.phone;
  if (order.email) receiver.contactEmail = order.email;

  var sender = {
    personName: cfg('SENDER_NAME'),
    altName: cfg('SENDER_NAME'), // ant lipduko rodomas vardas (override paskyros pavadinimui)
    contactMobile: cfg('SENDER_PHONE'),
    contactEmail: cfg('SENDER_EMAIL'),
    address: {
      country: cfg('SENDER_COUNTRY') || 'LT',
      postcode: cfg('SENDER_POSTCODE'),
      deliverypoint: cfg('SENDER_CITY'),
      street: cfg('SENDER_STREET'),
    },
  };

  var shipment = {
    partnerShipmentId: String(order.partner_shipment_id),
    mainService: 'PARCEL',
    deliveryChannel: 'PARCEL_MACHINE',
    returnAllowed: true, // sugeneruoja grąžinimo kodą gavėjui
    receiverAddressee: receiver,
    senderAddressee: sender,
  };

  var body = { customerCode: cfg('OMNIVA_CUSTOMER_CODE'), shipments: [shipment] };
  var res = omnivaPost('/shipments/business-to-client', body);

  return { barcode: extractBarcode(res), raw: res };
}

/**
 * Pagal manual'ą (1.4.2): atsakyme resultCode "OK"/"ERROR",
 * savedShipments[].barcode arba failedShipments[].{messageCode,message}.
 */
function extractBarcode(res) {
  if (!res) throw new Error('Omniva: tuščias atsakymas');
  if (res.failedShipments && res.failedShipments.length) {
    var f = res.failedShipments[0];
    throw new Error('Omniva atmetė siuntą: ' + (f.message || f.messageCode || 'nežinoma klaida'));
  }
  if (res.savedShipments && res.savedShipments.length && res.savedShipments[0].barcode) {
    return res.savedShipments[0].barcode;
  }
  if (res.resultCode === 'ERROR') {
    throw new Error('Omniva resultCode=ERROR: ' + JSON.stringify(res).slice(0, 300));
  }
  throw new Error('Omniva: atsakyme nerasta barcode: ' + JSON.stringify(res).slice(0, 300));
}

/**
 * Atvirkštinė (grąžinimo) siunta: KLIENTAS = siuntėjas, TU = gavėjas savo
 * grąžinimo pastomate. Klientas numeš prekę bet kuriame pastomate, ji atkeliaus
 * pas tave. Telefonas — kliento (kad jis gautų pranešimus).
 */
function registerReturnShipment(o, returnLocker) {
  var parts = String(o['Adresas'] || '').split(',').map(function (s) { return s.trim(); });
  var sender = {
    personName: o['Klientas'],
    address: {
      country: (o['Šalis'] || cfg('SENDER_COUNTRY') || 'LT'),
      street: parts[0] || '',
      postcode: parts[1] || '',
      deliverypoint: parts[2] || parts[1] || '',
    },
  };
  if (o['Telefonas']) sender.contactMobile = o['Telefonas'];
  if (o['El. paštas']) sender.contactEmail = o['El. paštas'];

  var receiver = {
    personName: cfg('SENDER_NAME'),
    address: { country: cfg('SENDER_COUNTRY') || 'LT', offloadPostcode: String(returnLocker.id) },
  };
  if (cfg('SENDER_PHONE')) receiver.contactMobile = cfg('SENDER_PHONE');
  if (cfg('SENDER_EMAIL')) receiver.contactEmail = cfg('SENDER_EMAIL');

  var shipment = {
    partnerShipmentId: String(o['Užsakymas']) + '-R',
    mainService: 'PARCEL',
    deliveryChannel: 'PARCEL_MACHINE',
    receiverAddressee: receiver,
    senderAddressee: sender,
  };
  var res = omnivaPost('/shipments/business-to-client', { customerCode: cfg('OMNIVA_CUSTOMER_CODE'), shipments: [shipment] });
  return { barcode: extractBarcode(res), raw: res };
}

/** Lipduko PDF. Be el. pašto grąžina base64 PDF atsakyme. */
function requestLabel(barcodes, toEmail) {
  // Omniva tikisi [{ barcode: "..." }], ne ["..."]
  var barcodeObjects = barcodes.map(function (b) {
    return typeof b === 'string' ? { barcode: b } : b;
  });
  var body = {
    customerCode: cfg('OMNIVA_CUSTOMER_CODE'),
    barcodes: barcodeObjects,
    sendAddressCardTo: toEmail ? 'EMAIL' : 'RESPONSE',
  };
  if (toEmail) body.cardReceiverEmail = toEmail;
  return omnivaPost('/shipments/package-labels', body);
}

/** Siuntos sekimo įvykiai (1.10.3 barcode metodas — GET /shipments/{barcode}). */
function trackShipment(barcode) {
  return omnivaGet('/shipments/' + encodeURIComponent(barcode));
}

/**
 * Registruoja Omniva grąžinimą (1.5). Originali siunta turi būti DELIVERED.
 * Grąžina naują grąžinimo barcode.
 */
function registerReturn(barcode, partnerShipmentId) {
  var ret = { barcode: barcode };
  if (partnerShipmentId) ret.partnerShipmentId = String(partnerShipmentId);
  var res = omnivaPost('/shipments/omniva-return', {
    customerCode: cfg('OMNIVA_CUSTOMER_CODE'),
    returnShipments: [ret],
  });
  if (res.failedShipments && res.failedShipments.length) {
    var f = res.failedShipments[0];
    throw new Error('Grąžinimo klaida: ' + (f.message || f.messageCode));
  }
  var saved = (res.savedShipments && res.savedShipments[0]) || {};
  return { barcode: saved.barcode || '', raw: res };
}

/**
 * Perkelia jau registruotą siuntą į kitą pastomatą (1.6). Veikia tik kol
 * siuntos statusas REGISTERED. Naudinga, kai klientas nori kito pastomato.
 */
function changeLocker(barcode, order, locker) {
  var receiver = {
    personName: order.name,
    address: {
      country: order.country,
      offloadPostcode: String(locker.id),
    },
  };
  if (order.phone) receiver.contactMobile = order.phone;
  if (order.email) receiver.contactEmail = order.email;

  return omnivaPost('/shipments', {
    customerCode: cfg('OMNIVA_CUSTOMER_CODE'),
    barcode: barcode,
    needsRelabel: false,
    deliveryChannel: 'PARCEL_MACHINE',
    receiverAddressee: receiver,
  });
}

/** Tracking nuoroda klientui (pagal šabloną). */
function trackingUrl(barcode) {
  return String(cfg('TRACKING_URL_TEMPLATE')).replace('{barcode}', encodeURIComponent(barcode));
}
/**
 * Drive.gs — Omniva lipdukų (PDF) saugojimas Google Drive ir nuorodos grąžinimas.
 *
 * Srautas: requestLabel() iš Omniva grąžina base64 PDF -> įrašom į Drive aplanką
 * -> gaunam viešą (su nuoroda) URL -> jį įrašom į užsakymo eilutę / Shopify.
 */

/** Drive aplankas lipdukams: pirma pagal ID, kitaip pagal pavadinimą. */
function getLabelFolder() {
  var id = cfg('DRIVE_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); }
    catch (e) { throw new Error('Nepavyko atidaryti Drive aplanko pagal ID (' + id + '). Patikrink, ar turi prieigą.'); }
  }
  var name = cfg('DRIVE_FOLDER') || 'Omniva lipdukai';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/** Įrašo base64 PDF į Drive (failas pavadinamas pagal užsakymo nr), grąžina nuorodą. */
function saveLabelToDrive(orderName, barcode, base64pdf) {
  var folder = getLabelFolder();
  var base = String(orderName || ('Omniva_' + barcode)).replace(/[\\/:*?"<>|#]/g, '').trim();
  var fname = base + '.pdf';

  // jei tas pats užsakymas perdaromas — pašalinam seną to paties pavadinimo lipduką
  var old = folder.getFilesByName(fname);
  while (old.hasNext()) old.next().setTrashed(true);

  var blob = Utilities.newBlob(Utilities.base64Decode(base64pdf), 'application/pdf', fname);
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT); // pasiekiama bet kam su nuoroda
  } catch (e) {
    // jei organizacija draudžia viešą dalinimąsi — paliekam privatų, nuoroda veiks savininkui
  }
  return file.getUrl();
}

/**
 * Atsparus lipduko duomenų ištraukimas.
 * Omniva grąžina successAddressCards[].fileData (base64 PDF, didžioji D!),
 * arba (rečiau) URL. Grąžina { type: 'base64'|'url', data: '...' } arba null.
 */
function extractLabelData(res) {
  if (!res) return null;
  var arr = res.successAddressCards || res.addressCards || [];
  if (arr.length && arr[0]) {
    var card = arr[0];
    var fd = card.fileData || card.filedata || card.file_data;
    if (fd) return { type: 'base64', data: fd };
    var url = card.fileUrl || card.url || card.labelUrl || card.documentUrl || card.mergedDocumentUrl;
    if (url) return { type: 'url', data: url };
  }
  var topFd = res.fileData || res.filedata;
  if (topFd) return { type: 'base64', data: topFd };
  var topUrl = res.fileUrl || res.mergedDocumentUrl || res.url;
  if (topUrl) return { type: 'url', data: topUrl };
  return null;
}

/**
 * Paima lipduką iš Omniva ir įrašo į Drive pagal užsakymo nr.
 * Omniva LIVE grąžina pre-signed URL → atsisiunčiame PDF ir saugome.
 * Grąžina Drive nuorodą. Jei toEmail nurodytas — Omniva nusiunčia el. paštu.
 */
function generateAndStoreLabel(orderName, barcode, toEmail) {
  if (toEmail) {
    requestLabel([barcode], toEmail);
    return '';
  }
  var res = requestLabel([barcode], null);
  var label = extractLabelData(res);
  if (!label) {
    throw new Error('Negautas lipdukas. Omniva atsakymas: ' + JSON.stringify(res).slice(0, 400));
  }

  var pdfBase64;
  if (label.type === 'url') {
    // Omniva LIVE grąžina pre-signed S3 URL (galioja ~5 min) — atsisiunčiame iš karto
    var pdfResp = UrlFetchApp.fetch(label.data, { muteHttpExceptions: true });
    if (pdfResp.getResponseCode() !== 200) {
      throw new Error('Nepavyko atsisiųsti lipduko PDF (' + pdfResp.getResponseCode() + ')');
    }
    pdfBase64 = Utilities.base64Encode(pdfResp.getContent());
  } else {
    pdfBase64 = label.data;
  }

  return saveLabelToDrive(orderName, barcode, pdfBase64);
}
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
/** Ar tikras (ne testinis) siuntos kodas. */
function isRealBarcode(b) {
  return b && String(b).indexOf('TEST') !== 0;
}

/** HYPERLINK formulė į Omniva sekimą (setFormula naudoja kablelį — nepriklauso nuo kalbos). */
function trackingFormula(barcode) {
  return '=HYPERLINK("' + trackingUrl(barcode) + '", "' + barcode + '")';
}

/** Įrašo siuntos kodą į langelį: kaip nuorodą (jei tikras) arba paprastą tekstą. */
function _setTrackingCell(range, barcode) {
  if (isRealBarcode(barcode)) range.setFormula(trackingFormula(barcode));
  else range.setValue(barcode || '');
}

function upsertOrder(rec) {
  var s = _sheet();
  var existing = _findRow(s, rec.order);
  if (existing) {
    HEADERS.forEach(function (h, i) {
      var k = HEADER_KEY[h];
      if (!(k && rec.hasOwnProperty(k))) return;
      if (h === 'Tracking') _setTrackingCell(s.getRange(existing, i + 1), rec[k]);
      else s.getRange(existing, i + 1).setValue(rec[k]);
    });
    return existing;
  }
  var row = HEADERS.map(function (h) {
    var k = HEADER_KEY[h];
    return k && rec.hasOwnProperty(k) ? rec[k] : '';
  });
  if (!rec.hasOwnProperty('time')) row[HEADERS.indexOf('Laikas')] = new Date();
  s.appendRow(row);
  var newRow = s.getLastRow();
  if (rec.hasOwnProperty('tracking') && isRealBarcode(rec.tracking)) {
    _setTrackingCell(s.getRange(newRow, _col('Tracking')), rec.tracking);
  }
  return newRow;
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

/** Įrašo naują tracking (kaip nuorodą). */
function setTracking(orderName, barcode) {
  var s = _sheet();
  var row = _findRow(s, orderName);
  if (!row) return false;
  _setTrackingCell(s.getRange(row, _col('Tracking')), barcode);
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
/**
 * Shopify.gs — Shopify Admin API.
 *
 * Pagrindinis tikslas (pagal pasirinktą srautą): įrašyti Omniva tracking kodą +
 * pastomatą į užsakymą ir pažymėti "fulfilled". Tada Print Order Pro automatiškai
 * išsiunčia klientui laišką su sąskaita + tracking. Atskiro laiško nesiunčiam.
 *
 * Veiksmai:
 *   addLockerToOrder(orderId, lockerName)  -> įrašo pastomatą į note_attributes
 *   fulfillOrderWithTracking(...)          -> sukuria fulfillment su tracking
 */

var SHOPIFY_API_VERSION = '2025-07';

function shopifyBase() {
  return 'https://' + cfg('SHOPIFY_SHOP') + '/admin/api/' + SHOPIFY_API_VERSION;
}

/** Bendras GraphQL kvietimas į Shopify Admin API (patikimiau fulfillment'ui). */
function shopifyGraphQL(query, variables) {
  if (!shopifyReady()) throw new Error('Trūksta Shopify raktų.');
  var resp = UrlFetchApp.fetch(shopifyBase() + '/graphql.json', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Shopify-Access-Token': getShopifyAccessToken() },
    payload: JSON.stringify({ query: query, variables: variables || {} }),
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode(), text = resp.getContentText();
  if (code < 200 || code >= 300) throw new Error('Shopify GraphQL klaida (' + code + '): ' + text);
  var data = JSON.parse(text);
  if (data.errors) throw new Error('Shopify GraphQL: ' + JSON.stringify(data.errors).slice(0, 300));
  return data.data;
}

/**
 * Grąžina galiojantį Shopify Admin API access token'ą.
 *  - Jei įvestas statinis SHOPIFY_ADMIN_TOKEN (legacy) — naudojam jį.
 *  - Kitaip iš Client ID + Secret automatiškai gaunam token'ą per Client Credentials
 *    Grant (galioja ~24 val.) ir laikom talpykloje. Taip nereikia rankiniu būdu
 *    atnaujinti token'o — sistema pati pasiima naują.
 * SVARBU: app turi būti įdiegtas toje pačioje parduotuvėje (tavo nuosava) — tada CCG veikia.
 */
function getShopifyAccessToken() {
  var staticTok = cfg('SHOPIFY_ADMIN_TOKEN');
  var cid = cfg('SHOPIFY_CLIENT_ID'), csec = cfg('SHOPIFY_CLIENT_SECRET');
  if (!cid || !csec) {
    if (staticTok) return staticTok;
    throw new Error('Trūksta Shopify raktų: įvesk Client ID + Secret (arba Admin token).');
  }
  var cache = CacheService.getScriptCache();
  var cached = cache.get('shopify_ccg_token');
  if (cached) return cached;

  var resp = UrlFetchApp.fetch('https://' + cfg('SHOPIFY_SHOP') + '/admin/oauth/access_token', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ grant_type: 'client_credentials', client_id: cid, client_secret: csec }),
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode(), text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Shopify token (Client Credentials) klaida (' + code + '): ' + text);
  }
  var data = JSON.parse(text);
  if (!data.access_token) throw new Error('Shopify CCG: negautas access_token: ' + text.slice(0, 200));
  // CacheService maks. 6 val.; token galioja ~24 val., tad atsinaujins kas kelias valandas.
  var ttl = Math.max(60, Math.min((data.expires_in || 86399) - 300, 21600));
  cache.put('shopify_ccg_token', data.access_token, ttl);
  return data.access_token;
}

/** Bendras kvietimas į Shopify Admin API. */
function shopifyFetch(method, path, body) {
  if (!shopifyReady()) throw new Error('Trūksta Shopify raktų (SHOPIFY_SHOP + Client ID/Secret arba Admin token).');
  var opts = {
    method: method,
    contentType: 'application/json',
    headers: { 'X-Shopify-Access-Token': getShopifyAccessToken() },
    muteHttpExceptions: true,
  };
  if (body) opts.payload = JSON.stringify(body);
  var resp = UrlFetchApp.fetch(shopifyBase() + path, opts);
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Shopify API klaida (' + code + '): ' + text);
  }
  return text ? JSON.parse(text) : {};
}

/** Įrašo pastomato pavadinimą į užsakymo note_attributes (Print Order Pro gali rodyti). */
function addLockerToOrder(orderId, lockerName) {
  var field = cfg('LOCKER_NOTE_FIELD') || 'Paštomatas';
  // Pasiimam esamus note_attributes, kad neperrašytume kitų.
  var existing = shopifyFetch('get', '/orders/' + orderId + '.json?fields=note_attributes').order || {};
  var attrs = existing.note_attributes || [];
  var found = false;
  attrs.forEach(function (a) {
    if (a.name === field) {
      a.value = lockerName;
      found = true;
    }
  });
  if (!found) attrs.push({ name: field, value: lockerName });

  return shopifyFetch('put', '/orders/' + orderId + '.json', {
    order: { id: orderId, note_attributes: attrs },
  });
}

/**
 * Įrašo kelis naudingus laukus į užsakymo note_attributes — jie matomi Shopify
 * užsakymo lange „Additional details" kortelėje (kaip kažkada darė Parcely).
 * Sujungia su esamais (neperrašo svetimų laukų). Tušti laukai praleidžiami.
 */
function writeOrderDetails(orderId, details) {
  var existing = shopifyFetch('get', '/orders/' + orderId + '.json?fields=note_attributes').order || {};
  var attrs = existing.note_attributes || [];
  var byName = {};
  attrs.forEach(function (a) { byName[a.name] = a; });

  Object.keys(details).forEach(function (name) {
    var value = details[name];
    if (value === undefined || value === null || String(value) === '') return;
    value = String(value);
    if (byName[name]) byName[name].value = value;
    else { var na = { name: name, value: value }; attrs.push(na); byName[name] = na; }
  });

  return shopifyFetch('put', '/orders/' + orderId + '.json', {
    order: { id: orderId, note_attributes: attrs },
  });
}

/** Užsakymo fulfillment orders (jų reikia, kad galėtume kurti fulfillment). */
function getFulfillmentOrders(orderId) {
  var res = shopifyFetch('get', '/orders/' + orderId + '/fulfillment_orders.json');
  return res.fulfillment_orders || [];
}

/**
 * Sukuria fulfillment su Omniva tracking. notify_customer pagal nustatymą
 * (numatyta false — laišką siunčia Print Order Pro, ne Shopify).
 */
function fulfillOrderWithTracking(orderId, barcode, trackUrl) {
  // Atvirus fulfillment orders imam per GraphQL (REST fulfillment naujose API versijose nepatikimas).
  var d1 = shopifyGraphQL(
    'query($id:ID!){ order(id:$id){ fulfillmentOrders(first:10){ edges{ node{ id status } } } } }',
    { id: 'gid://shopify/Order/' + orderId });
  var edges = (d1.order && d1.order.fulfillmentOrders && d1.order.fulfillmentOrders.edges) || [];
  var openIds = edges
    .filter(function (e) { return e.node.status === 'OPEN' || e.node.status === 'IN_PROGRESS'; })
    .map(function (e) { return e.node.id; });
  if (!openIds.length) throw new Error('Užsakymas neturi atvirų fulfillment orders (gal jau įvykdytas?).');

  var notify = String(cfg('NOTIFY_CUSTOMER')).toLowerCase() === 'true';
  var d2 = shopifyGraphQL(
    'mutation f($fulfillment: FulfillmentV2Input!){ fulfillmentCreateV2(fulfillment:$fulfillment){ fulfillment{ id status } userErrors{ field message } } }',
    { fulfillment: {
        notifyCustomer: notify,
        trackingInfo: { number: barcode, url: trackUrl, company: 'Omniva' },
        lineItemsByFulfillmentOrder: openIds.map(function (id) { return { fulfillmentOrderId: id }; }),
    } });
  var ue = d2.fulfillmentCreateV2 && d2.fulfillmentCreateV2.userErrors;
  if (ue && ue.length) throw new Error('Fulfillment: ' + ue.map(function (e) { return e.message; }).join('; '));
  return d2.fulfillmentCreateV2.fulfillment;
}

/**
 * Ištraukia kliento pasirinktą pastomatą iš užsakymo, jei toks yra
 * (note_attributes arba line item properties). Grąžina {id, name} arba null.
 */
function lockerFromOrder(order) {
  var field = (cfg('LOCKER_NOTE_FIELD') || 'Paštomatas').toLowerCase();
  var candidates = [];

  (order.note_attributes || []).forEach(function (a) {
    candidates.push({ name: (a.name || '').toLowerCase(), value: a.value });
  });
  (order.line_items || []).forEach(function (li) {
    (li.properties || []).forEach(function (p) {
      candidates.push({ name: (p.name || '').toLowerCase(), value: p.value });
    });
  });

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c.value) continue;
    // ieškom lauko, kuriame minimas pastomatas / locker / omniva
    if (c.name.indexOf(field) >= 0 || c.name.indexOf('locker') >= 0 ||
        c.name.indexOf('omniva') >= 0 || c.name.indexOf('pastomat') >= 0 ||
        c.name.indexOf('paštomat') >= 0) {
      return { raw: c.value };
    }
  }
  return null;
}
/**
 * Verify.gs — "Patikrinti" funkcija. Patikrina visą grandinę prieš LIVE.
 * Kviečiama iš dashboard'o; grąžina žingsnių sąrašą su ✅ / ❌.
 */

function runHealthCheck() {
  var steps = [];
  function ok(name, detail) { steps.push({ name: name, ok: true, detail: detail || '' }); }
  function fail(name, detail) { steps.push({ name: name, ok: false, detail: detail || '' }); }

  // 1. Lentelė
  try {
    _sheet();
    ok('Google lentelė', 'Lapas "Orders" pasiekiamas');
  } catch (e) { fail('Google lentelė', e.message); }

  // 2. Pastomatų sąrašas
  try {
    var lk = getLockers('LT');
    if (lk.length) ok('Pastomatų sąrašas', lk.length + ' LT pastomatų užkrauta');
    else fail('Pastomatų sąrašas', 'sąrašas tuščias');
  } catch (e) { fail('Pastomatų sąrašas', e.message); }

  // 3. Geokodavimas + artimiausias pastomatas
  try {
    var res = findNearest('LT', 'Gedimino pr. 9, Vilnius', 1);
    if (res.lockers && res.lockers.length) {
      ok('Adreso → pastomato paieška', 'Artimiausias: ' + res.lockers[0].name + ' (' + res.lockers[0].distance_km + ' km)');
    } else {
      fail('Adreso → pastomato paieška', res.error || 'nerasta');
    }
  } catch (e) { fail('Adreso → pastomato paieška', e.message); }

  // 4. Shopify ryšys
  if (shopifyReady()) {
    try {
      var shop = shopifyFetch('get', '/shop.json?fields=name,domain').shop;
      ok('Shopify ryšys', 'Prisijungta: ' + (shop && shop.name));
    } catch (e) { fail('Shopify ryšys', e.message); }
  } else {
    steps.push({ name: 'Shopify ryšys', ok: false, warn: true, detail: 'Raktai dar neįvesti (nustatymuose)' });
  }

  // 5. Omniva ryšys (sukuriam TEST siuntą test aplinkoje)
  if (omnivaReady()) {
    _forceTestOmniva = true; // patikra NIEKADA nekuria realios siuntos
    try {
      var testOrder = { partner_shipment_id: 'HEALTHCHECK-' + Date.now(), name: 'Testas Testaitis', email: cfg('SENDER_EMAIL') || 'test@test.lt', phone: '+37060000000', country: 'LT' };
      var lk2 = getLockers('LT')[0];
      var ship = registerShipment(testOrder, lk2);
      if (ship.barcode) ok('Omniva siunta (TEST)', 'Gautas tracking: ' + ship.barcode + ' (test aplinka)');
      else fail('Omniva siunta (TEST)', 'siunta sukurta, bet negautas barcode: ' + JSON.stringify(ship.raw).slice(0, 200));
    } catch (e) { fail('Omniva siunta (TEST)', e.message); }
    finally { _forceTestOmniva = false; }
  } else {
    steps.push({ name: 'Omniva siunta', ok: false, warn: true, detail: 'Raktai dar neįvesti (nustatymuose)' });
  }

  // 6. Webhook token
  if (cfg('WEBHOOK_TOKEN')) ok('Webhook token', 'Nustatytas');
  else fail('Webhook token', 'Sugeneruok nustatymuose ir įdėk į Shopify webhook URL');

  // 7. Siuntėjo adresas
  if (cfg('SENDER_NAME') && cfg('SENDER_POSTCODE')) ok('Siuntėjo adresas', 'Užpildytas');
  else steps.push({ name: 'Siuntėjo adresas', ok: false, warn: true, detail: 'Užpildyk nustatymuose (reikia Omniva siuntai)' });

  return { mode: cfg('MODE'), steps: steps };
}

/** Dashboard'o veiksmai grąžinimams — pažymi lentelėje. */
function uiMarkReturned(orderName) {
  markReturned(orderName, new Date());
  updateOrderStatus(orderName, 'Grąžinta', null);
  return listOrders(200);
}

/**
 * Užregistruoja realų Omniva grąžinimą pagal užsakymo tracking (1.5 API).
 * Veikia tik jei originali siunta jau DELIVERED. Grąžina grąžinimo barcode.
 */
function uiRegisterReturn(orderName, tracking) {
  if (!isLive() || !omnivaReady()) {
    // TEST režime tik pažymim
    markReturned(orderName, new Date());
    updateOrderStatus(orderName, 'Grąžinta (TEST)', 'TEST režimas — reali grąžinimo siunta nesukurta.');
    return { ok: true, simulated: true, orders: listOrders(200) };
  }
  var ret = registerReturn(tracking, orderName);
  markReturned(orderName, new Date());
  updateOrderStatus(orderName, 'Grąžinta', 'Grąžinimo barcode: ' + ret.barcode);
  return { ok: true, returnBarcode: ret.barcode, orders: listOrders(200) };
}

/** Dashboard'o veiksmas: perdaryti užsakymą rankiniu būdu pagal jo numerį (paima iš Shopify). */
function uiReprocessOrder(orderId) {
  if (!shopifyReady()) throw new Error('Reikia Shopify raktų, kad paimtume užsakymą.');
  var order = shopifyFetch('get', '/orders/' + orderId + '.json').order;
  return processOrder(order);
}

/**
 * Rankinis „Įvykdyti" — kai automatinis fulfill nepavyko (pvz. blogas token),
 * bet siunta JAU sukurta ir duomenys lentelėje. NEkuria naujos Omniva siuntos:
 * paima esamą tracking'ą, įrašo info į užsakymą („Additional details") ir pažymi
 * „fulfilled". Taip pat tai atnaujina užsakymą Shopify (suveikia order-update eksportas).
 */
function uiFulfillExisting(orderName) {
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas: ' + orderName);
  var barcode = o['Tracking'];
  if (!barcode || String(barcode).indexOf('TEST') === 0) throw new Error('Nėra realaus tracking kodo (pirma sukurk siuntą).');
  if (!o['OrderID']) throw new Error('Nėra Shopify OrderID — šis užsakymas ne iš Shopify.');
  if (!shopifyReady()) throw new Error('Trūksta Shopify raktų (Nustatymai).');

  writeOrderDetails(o['OrderID'], {
    'Paštomatas': o['Pastomatas'],
    'Atstumas nuo kliento': o['km'] ? (o['km'] + ' km') : '',
    'Kiti artimi paštomatai': o['3 artimiausi'] || '',
    'Omniva tracking': barcode,
    'Tracking nuoroda': trackingUrl(barcode),
    'Lipdukas (PDF)': o['Lipdukas'] || '',
  });
  fulfillOrderWithTracking(o['OrderID'], barcode, trackingUrl(barcode));
  upsertOrder({ order: orderName, fulfilledOk: '✅', status: 'Įvykdyta', notes: 'Rankiniu būdu įvykdyta (Įvykdyti mygtukas).' });
  return { ok: true, orders: listOrders(200) };
}

// ---------------------------------------------------------------------------
// Rankiniai veiksmai dashboard'e (lipdukas, pastomato keitimas, tel. keitimas)
// ---------------------------------------------------------------------------

/** Pagal lentelės eilutę paruošia Omniva order objektą. */
function rowToOmnivaOrder(o, phoneOverride) {
  return {
    partner_shipment_id: o['Užsakymas'],
    name: o['Klientas'],
    email: o['El. paštas'],
    phone: phoneOverride || o['Telefonas'],
    country: o['Šalis'],
  };
}

/** Sugeneruoja (arba persiunčia) lipduką ir įrašo Drive nuorodą. */
function uiGenerateLabel(orderName) {
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas: ' + orderName);
  var barcode = o['Tracking'];
  if (!barcode || String(barcode).indexOf('TEST') === 0) {
    throw new Error('Nėra realaus tracking — pirma sukurk siuntą (LIVE arba su Omniva raktais).');
  }
  var url = generateAndStoreLabel(orderName, barcode, cfg('LABEL_TO_EMAIL') || null);
  if (url) setLabelUrl(orderName, url);
  return { ok: true, label: url, orders: listOrders(200) };
}

/** Grąžina 3 artimiausius pastomatus perparinkimui. */
function uiGetNearest(orderName) {
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas');
  var near = findNearest(o['Šalis'], o['Adresas'], 3);
  return (near.lockers || []).map(function (l) {
    return { id: l.id, name: l.name, address: l.address, km: l.distance_km };
  });
}

/** Paieška: pastomatas pagal pavadinimą/miestą pasirinktoje šalyje (be diakritikų, pagal žodžius). */
function uiSearchLockers(orderName, query, country) {
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas');
  if (!String(query || '').trim()) return [];
  var c = (country || o['Šalis'] || 'LT').toUpperCase();
  var lockers = getLockers(c);
  var coords = null;
  try { coords = geocode(o['Adresas'], o['Šalis'] || c); } catch (e) {}
  var out = [];
  for (var i = 0; i < lockers.length; i++) {
    if (lockerMatchesQuery(lockers[i], query)) {
      var km = coords ? round2(haversine(coords.lat, coords.lon, lockers[i].lat, lockers[i].lon)) : '';
      out.push({ id: lockers[i].id, name: lockers[i].name, address: lockers[i].address, km: km });
    }
  }
  if (coords) out.sort(function (a, b) { return a.km - b.km; });
  return out.slice(0, 25);
}

/** Bendra pastomato perparinkimo logika (naudoja ir dashboard, ir lentelės „OK"). */
function doReassign(o, locker) {
  var orderName = o['Užsakymas'];
  var barcode = o['Tracking'];
  var labelUrl = '';
  var note = '';
  if (omnivaReady() && barcode && String(barcode).indexOf('TEST') !== 0) {
    changeLocker(barcode, rowToOmnivaOrder(o), locker); // tas pats barcode, naujas pastomatas
    try { labelUrl = generateAndStoreLabel(orderName, barcode, cfg('LABEL_TO_EMAIL') || null); }
    catch (e) { note = ' (lipdukas: ' + e.message + ')'; }
  } else {
    note = ' (TEST — Omniva nekeista)';
  }
  if (isLive() && shopifyReady() && o['OrderID']) {
    try { addLockerToOrder(o['OrderID'], locker.name + ' (' + locker.address + ')'); } catch (e) {}
  }
  var rec = {
    order: orderName, locker: locker.name, lockerId: locker.id, km: locker.distance_km || '',
    notes: 'Pastomatas pakeistas į ' + locker.name + note,
  };
  if (labelUrl) { rec.label = labelUrl; rec.labelOk = '✅'; setLabelUrl(orderName, labelUrl); }
  upsertOrder(rec);
  return { ok: true, locker: locker.name, label: labelUrl };
}

/** Dashboard: perparinkti pagal pastomato ID (iš 3 artimiausių). */
function uiReassignLocker(orderName, lockerId) {
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas');
  var locker = lockerById(o['Šalis'], lockerId);
  if (!locker) throw new Error('Pastomatas nerastas: ' + lockerId);
  doReassign(o, locker);
  return { ok: true, orders: listOrders(200) };
}

/** Lentelės „OK": perparinkti pagal įrašytą pastomato PAVADINIMĄ. */
function reassignByName(orderName, lockerName) {
  var o = getOrder(orderName);
  if (!o) return { ok: false, error: 'Užsakymas nerastas' };
  var locker = lockerByName(o['Šalis'], lockerName);
  if (!locker) return { ok: false, error: 'Pastomatas nerastas: ' + lockerName };
  return doReassign(o, locker);
}

/**
 * Sukuria atvirkštinį GRĄŽINIMO lipduką ir prideda NAUJĄ eilutę.
 * Klientas = siuntėjas, tu = gavėjas grąžinimo pastomate (RETURN_LOCKER).
 */
function createReturnLabel(orderName) {
  var o = getOrder(orderName);
  if (!o) return { ok: false, error: 'Užsakymas nerastas' };
  var rl = cfg('RETURN_LOCKER');
  if (!rl) return { ok: false, error: 'Nustatymuose nenurodytas grąžinimo pastomatas (RETURN_LOCKER)' };
  var country = cfg('SENDER_COUNTRY') || 'LT';
  var locker = /^\d+$/.test(String(rl).trim()) ? lockerById(country, rl) : lockerByName(country, rl);
  if (!locker) return { ok: false, error: 'Grąžinimo pastomatas nerastas: ' + rl };

  var retName = orderName + '-GRAZ';
  var barcode = '', labelUrl = '';
  if (omnivaReady()) {
    var ship = registerReturnShipment(o, locker);
    barcode = ship.barcode;
    try { labelUrl = generateAndStoreLabel(retName, barcode, cfg('LABEL_TO_EMAIL') || null); } catch (e) {}
  } else {
    barcode = 'TEST-GRAZ-' + Date.now();
  }

  upsertOrder({
    order: retName, customer: o['Klientas'], email: o['El. paštas'], phone: o['Telefonas'],
    country: country, address: o['Adresas'], locker: locker.name, lockerId: locker.id,
    tracking: barcode, label: labelUrl,
    shipmentOk: barcode ? '↩️' : '❌', labelOk: labelUrl ? '✅' : '—',
    status: 'Grąžinimo lipdukas',
    notes: 'Atvirkštinis: klientas siuntėjas → ' + locker.name + ' (tavo). Tel.: ' + o['Telefonas'],
  });
  // Originalioje eilutėje „Grąžinta" stulpelyje — grąžinimo lipduko nuoroda (pasiekiama bet kam)
  if (labelUrl) markReturned(orderName, labelUrl);
  return { ok: true, tracking: barcode, label: labelUrl, locker: locker.name };
}

/** Keičia kliento telefoną ir perdaro siuntą/lipduką su nauju numeriu. */
function uiUpdatePhone(orderName, newPhone) {
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas');
  var phone = normalizePhone(newPhone, o['Šalis']);
  if (!phone) throw new Error('Tuščias telefonas');

  var barcode = o['Tracking'];
  var locker = lockerById(o['Šalis'], o['Pastomato ID']);
  if (omnivaReady() && barcode && String(barcode).indexOf('TEST') !== 0 && locker) {
    o['Telefonas'] = phone; // kad changeLocker naudotų naują numerį
    changeLocker(barcode, rowToOmnivaOrder(o, phone), locker); // tas pats barcode, naujas receiver
    try { var url = generateAndStoreLabel(orderName, barcode, cfg('LABEL_TO_EMAIL') || null); if (url) setLabelUrl(orderName, url); } catch (e) {}
  }
  if (isLive() && shopifyReady() && o['OrderID']) {
    try { shopifyFetch('put', '/orders/' + o['OrderID'] + '.json', { order: { id: o['OrderID'], phone: phone } }); } catch (e) {}
  }
  upsertOrder({ order: orderName, phone: phone, notes: 'Telefonas pakeistas, lipdukas pergeneruotas. Tracking nepakito: ' + barcode });
  return { ok: true, phone: phone, orders: listOrders(200) };
}

/** Dashboard'o duomenys vienu kvietimu. */
function uiGetData() {
  return {
    mode: cfg('MODE'),
    live: isLive(),
    omnivaReady: omnivaReady(),
    shopifyReady: shopifyReady(),
    orders: listOrders(200),
  };
}
/**
 * Edit.gs — valdymas tiesiai Google lentelėje.
 *
 *  - Meniu "Omnibox" (onOpen): paruošti lentelę, įjungti trigerį, parodyti pulto URL.
 *  - "Pakeisti pastomatą" tiesiai eilutėje: į stulpelį "Naujas pastomatas" įrašai
 *    tikslų pastomato pavadinimą, į "Patvirtinti (OK)" įrašai OK -> automatiškai
 *    perparenkamas pastomatas, pergeneruojamas lipdukas, rezultatas rašomas į
 *    "Pakeitimo rezultatas".
 *
 * SVARBU: ši automatika kviečia Omniva/Drive, todėl reikia ĮDIEGIAMO onEdit
 * trigerio (paprastas onEdit neturi teisių). Įdiek vieną kartą per meniu
 * "Omnibox → Įjungti pastomato keitimo trigerį" (setupTriggers).
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Omnibox')
      .addItem('1. Paruošti lentelę (stulpelius)', 'setupSheet')
      .addItem('2. Įjungti pastomato keitimo trigerį', 'setupTriggers')
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('🧪 Testas: siunta + lipdukas')
        .addItem('Lietuva (LT)', 'testLabelFlowLT')
        .addItem('Latvija (LV)', 'testLabelFlowLV')
        .addItem('Estija (EE)', 'testLabelFlowEE'))
      .addSeparator()
      .addItem('Parodyti pulto (dashboard) URL', 'showDashboardUrl')
      .addToUi();
  } catch (e) {}
}

/** Įdiegia onEdit trigerį, kad veiktų „OK" lentelėje. */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  try { SpreadsheetApp.getUi().alert('Trigeris įjungtas ✅\nDabar lentelėje gali keisti pastomatą įrašant pavadinimą + OK.'); } catch (e) {}
  return true;
}

/** Parodo Web App (pulto) URL, jei jau padarytas Deploy. */
function showDashboardUrl() {
  var url = ScriptApp.getService().getUrl();
  var msg = url
    ? 'Tavo pulto URL:\n\n' + url + '\n\n(Webhook\'ui Shopify\'uje pridėk ?token=...)'
    : 'Dar nepadarytas Deploy. Eik: Deploy → New deployment → Web app.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/**
 * Įdiegiamas onEdit: reaguoja į "OK" stulpelyje "Patvirtinti (OK)".
 */
function onEditInstalled(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEET_NAME) return;
    var col = e.range.getColumn(), row = e.range.getRow();
    if (row < 2) return;
    if (String(e.value || '').trim().toLowerCase() !== 'ok') return;

    var resCol = _col('Veiksmo rezultatas');
    var orderName = sh.getRange(row, _col('Užsakymas')).getValue();

    if (col === _col('Patvirtinti (OK)')) {
      var newName = sh.getRange(row, _col('Naujas pastomatas')).getValue();
      if (!newName) {
        sh.getRange(row, resCol).setValue('❌ Pirma įrašyk pastomato pavadinimą');
      } else {
        sh.getRange(row, resCol).setValue('⏳ Keičiama…');
        var r = reassignByName(orderName, newName);
        sh.getRange(row, resCol).setValue(r.ok ? ('✅ ' + r.locker + (r.label ? ' · lipdukas atnaujintas' : '')) : ('❌ ' + r.error));
      }
      sh.getRange(row, col).clearContent();

    } else if (col === _col('Sukurti grąžinimą (OK)')) {
      sh.getRange(row, resCol).setValue('⏳ Kuriamas grąžinimas…');
      var g = createReturnLabel(orderName);
      // be jokių užrašų — tik siuntos kodas; jei nepavyko — klaida
      sh.getRange(row, resCol).setValue(g.ok ? g.tracking : ('❌ ' + g.error));
      sh.getRange(row, col).clearContent();
    }
  } catch (err) {
    try { e.range.getSheet().getRange(e.range.getRow(), _col('Veiksmo rezultatas')).setValue('❌ ' + err.message); } catch (_) {}
  }
}
/**
 * Test.gs — bandomųjų užsakymų generatorius.
 *
 * Leidžia iškart pamatyti, kaip duomenys iš užsakymo krenta į "Orders" lentelę ir
 * dashboard'ą — be Shopify webhook'o ir be realių pinigų. Naudoja tą pačią
 * processOrder() grandinę kaip realus užsakymas.
 *
 * TEST režime (rekomenduojama): jei yra Omniva raktai — sukuria realią TEST siuntą
 * (test-omx.omniva.eu) ir lipduką; jei raktų nėra — imituoja barcode. Realaus
 * Shopify užsakymo neliečia.
 */

/** Pavyzdiniai užsakymai (imituoja Shopify orders/paid struktūrą). */
function sampleOrders() {
  var n = '#DBM3' + String(Date.now()).slice(-3); // realaus formato testinis nr, pvz. #DBM3274
  return [
    {
      id: '', name: n, email: 'testas@pavyzdys.lt', phone: '860000001',
      shipping_address: { name: 'Testas Vilnietis', address1: 'Gedimino pr. 9', zip: '01103', city: 'Vilnius', country_code: 'LT', phone: '860000001' },
      line_items: [{ title: 'Bandomoji prekė', quantity: 1 }],
    },
    {
      id: '', name: n, email: 'test@piemers.lv', phone: '+37120000001',
      shipping_address: { name: 'Test Rīdzinieks', address1: 'Brīvības iela 30', zip: 'LV-1011', city: 'Rīga', country_code: 'LV', phone: '+37120000001' },
      line_items: [{ title: 'Bandomoji prekė', quantity: 1 }],
    },
    {
      id: '', name: n, email: 'test@naide.ee', phone: '+37250000001',
      shipping_address: { name: 'Test Tallinlane', address1: 'Narva mnt 7', zip: '10117', city: 'Tallinn', country_code: 'EE', phone: '+37250000001' },
      line_items: [{ title: 'Bandomoji prekė', quantity: 1 }],
    },
  ];
}

/** Sukuria bandomąjį užsakymą (0=LT, 1=LV, 2=EE) ir praleidžia per grandinę. */
function uiCreateTestOrder(idx) {
  var orders = sampleOrders();
  var i = Math.max(0, Math.min(orders.length - 1, Number(idx) || 0));
  _forceTestOmniva = true; // bandomasis užsakymas NIEKADA nekuria realios Omniva siuntos
  try {
    var result = processOrder(orders[i]);
  } finally { _forceTestOmniva = false; }
  return { result: result, orders: listOrders(200) };
}

/** Paleisk redaktoriuje (Run), jei nori greito testo be dashboard'o. */
function testCreateSampleLT() {
  var r = uiCreateTestOrder(0);
  Logger.log(JSON.stringify(r.result, null, 2));
}

/**
 * PILNAS LIPDUKO TESTAS — paleisk šitą (Run) arba per meniu.
 * Praleidžia testinį užsakymą per visą sistemą ir aiškiai parodo kiekvieną žingsnį:
 *   1) adresas -> artimiausias pastomatas
 *   2) Omniva siunta (barcode)
 *   3) lipdukas (PDF) -> Google Drive nuoroda
 * Testinio užsakymo id tuščias, todėl net LIVE režime Shopify NELIEČIAMAS.
 *
 * country: 'LT' (numatyta), 'LV' arba 'EE'.
 */
function testLabelFlow(country) {
  var map = { LT: 0, LV: 1, EE: 2 };
  var idx = map[String(country || 'LT').toUpperCase()] || 0;
  var order = sampleOrders()[idx];

  var log = [];
  function L(s) { log.push(s); Logger.log(s); }

  L('===== OMNIBOX LIPDUKO TESTAS =====');
  L('Režimas: ' + cfg('MODE') + ' | Omniva raktai: ' + (omnivaReady() ? 'yra' : 'NĖRA'));
  L('Užsakymas: ' + order.name + '  (' + order.shipping_address.country_code + ')');
  L('Adresas: ' + [order.shipping_address.address1, order.shipping_address.zip, order.shipping_address.city].join(', '));
  L('----------------------------------');

  _forceTestOmniva = true; // testas NIEKADA nekuria realios Omniva siuntos
  try { var res = processOrder(order); } finally { _forceTestOmniva = false; }

  if (res.ok) {
    L('1) Pastomatas: ' + (res.locker && res.locker.name) + ' (' + (res.locker && res.locker.distance_km) + ' km)');
    L('2) Siuntos kodas (barcode): ' + (res.tracking || '—'));
    if (res.label) {
      L('3) ✅ LIPDUKAS DRIVE: ' + res.label);
      L('   -> Atidaryk šią nuorodą — tai tavo PDF lipdukas.');
    } else {
      L('3) ⚠️ Lipdukas NESUKURTAS. Žr. „Pastabos" stulpelį lentelėje.');
    }
    L('----------------------------------');
    L(res.simulated ? 'BAIGTA (TEST imitacija).' : '✅ BAIGTA SĖKMINGAI. Patikrink Drive aplanką ir lentelę.');
  } else {
    L('❌ KLAIDA: ' + res.error);
  }

  // Parodom suvestinę pop-up'e, jei paleista iš lentelės
  try { SpreadsheetApp.getUi().alert(log.join('\n')); } catch (e) {}
  return res;
}

/** Meniu pagalbininkai (LT/LV/EE) — kad būtų patogu paleisti iš lentelės meniu. */
function testLabelFlowLT() { return testLabelFlow('LT'); }
function testLabelFlowLV() { return testLabelFlow('LV'); }
function testLabelFlowEE() { return testLabelFlow('EE'); }
/**
 * Code.gs — pagrindinis įėjimo taškas.
 *
 *   doGet  : be parametrų  -> rodo dashboard'ą (HTML)
 *            su ?country=  -> greitas pastomato testas (JSON)
 *   doPost : Shopify "Order payment" (orders/paid) webhook'as ->
 *            parenka pastomatą, sukuria Omniva siuntą, įrašo tracking į Shopify
 *            (kad Print Order Pro išsiųstų laišką), užregistruoja į lentelę.
 *
 * Srautas pasirinktas: TRIGERIS = po apmokėjimo; LAIŠKAS = per Print Order Pro.
 */

/** GET: dashboard arba greitas testas. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.country) {
    var query = [p.street, p.postal, p.city].filter(Boolean).join(', ');
    return _json(findNearest(p.country, query, Number(p.limit || 3)));
  }
  return HtmlService.createTemplateFromFile('Dashboard')
    .evaluate()
    .setTitle('Omnibox — Omniva pultas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Įgalina include() HTML šablone (jei prireiktų dalių). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** POST: Shopify webhook'as. */
function doPost(e) {
  // 1. Apsauga — slaptas token URL'e (?token=...), nes Apps Script nemato antraščių.
  var token = (e && e.parameter && e.parameter.token) || '';
  if (!cfg('WEBHOOK_TOKEN') || token !== cfg('WEBHOOK_TOKEN')) {
    return _json({ ok: false, error: 'neteisingas arba trūkstamas token' });
  }

  var order;
  try {
    order = JSON.parse(e.postData.contents);
  } catch (err) {
    return _json({ ok: false, error: 'blogas JSON' });
  }

  var result = processOrder(order);
  return _json(result);
}

/**
 * Visa grandinė vienam užsakymui. Naudojama ir webhook'o, ir rankinio
 * "perdaryti" mygtuko dashboard'e.
 *
 * SVARBU dėl lygiagretaus darbo su Parcely:
 *   - LIVE režime rašom į Shopify (fulfillment + tracking) ir kuriam realią siuntą.
 *   - TEST režime veikiam kaip ŠEŠĖLIS: parenkam pastomatą, kuriam TEST siuntą,
 *     įrašom į lentelę/Drive, bet REALAUS užsakymo NELIEČIAM (kad nesidubliuotų
 *     su Parcely). Į Shopify rašom tik LIVE.
 */
function processOrder(order) {
  var a = order.shipping_address || {};
  var country = (a.country_code || cfg('SENDER_COUNTRY') || '').toUpperCase();
  var address = [a.address1, a.zip, a.city].filter(Boolean).join(', ');
  var orderName = order.name || String(order.id || '');
  var phone = normalizePhone(a.phone || order.phone || '', country);

  // APSAUGA NUO DUBLIKATŲ: Shopify kartoja webhook'ą, jei atsakymas vėluoja (>5 s),
  // o Omniva siunta + lipdukas užtrunka ~10 s. Be šios apsaugos kiekvienas kartojimas
  // sukurtų NAUJĄ Omniva siuntą (floodina servisą). Sprendimas:
  //   1) užraktas — lygiagrečios kopijos laukia, ne kuria antros siuntos;
  //   2) patikra — jei užsakymas JAU turi realų tracking'ą, naujos siuntos NEkuriam.
  var _lock = LockService.getScriptLock();
  try { _lock.waitLock(50000); } catch (e) {}
  try {
  var _prev = getOrder(orderName);
  if (_prev && _prev['Tracking'] && String(_prev['Tracking']).indexOf('TEST') !== 0) {
    return retryFulfillExisting(order, _prev); // jau turi siuntą — tik (per)bandom Shopify
  }

  var rec = {
    order: orderName,
    orderId: order.id || '',
    customer: a.name || (order.customer && (order.customer.first_name + ' ' + order.customer.last_name)) || '',
    email: order.email || (order.customer && order.customer.email) || '',
    phone: phone,
    country: country,
    address: address,
    status: 'Apdorojama',
  };

  try {
    // 2. Vienu geokodavimu gaunam 3 artimiausius pastomatus.
    var near = findNearest(country, address, 3);
    if (near.error || !near.lockers || !near.lockers.length) {
      // Lankstumas: jei pilnas adresas (pvz. be namo nr) nepavyko — bandom miestą+indeksą
      var fb = [a.zip, a.city].filter(Boolean).join(', ') || a.city || '';
      if (fb && fb !== address) near = findNearest(country, fb, 3);
    }
    if (near.error || !near.lockers || !near.lockers.length) {
      rec.status = 'KLAIDA: nerastas pastomatas';
      rec.notes = near.error || 'Nepavyko nustatyti adreso koordinačių. Apdoroti rankiniu būdu.';
      upsertOrder(rec);
      return { ok: false, error: rec.notes, order: orderName };
    }
    var picked = pickLocker(order, country, near.lockers);
    var locker = picked.locker;
    rec.locker = locker.name;
    rec.lockerId = locker.id;
    rec.km = locker.distance_km || '';
    rec.byCustomer = picked.byCustomer;
    rec.alt = near.lockers.map(function (l) { return l.name + ' (' + l.distance_km + ' km)'; }).join('  |  ');
    // Alternatyvos užsakymui — 2 artimiausi, IŠSKYRUS parinktą pastomatą.
    var altShort = near.lockers
      .filter(function (l) { return String(l.id) !== String(locker.id); })
      .slice(0, 2)
      .map(function (l) { return l.name + ' (' + l.distance_km + ' km)'; })
      .join('  |  ');

    // 3. Siunta: LIVE -> reali Omniva siunta; kitu atveju TEST/imitacija.
    var barcode, simulated = false;
    if (isLive() && omnivaReady()) {
      var ship = registerShipment(toOmnivaOrder(rec, country, phone), locker);
      barcode = ship.barcode;
    } else if (omnivaReady()) {
      // TEST aplinkoje sukuriam realų TEST barcode (patikrinam, kad veikia)
      var t = registerShipment(toOmnivaOrder(rec, country, phone), locker);
      barcode = t.barcode;
      simulated = true;
    } else {
      simulated = true;
      barcode = 'TEST' + (order.id || Date.now());
    }
    rec.tracking = barcode;
    // Tracking įrašom IŠ KARTO (kad dublikatų apsauga matytų jį net jei toliau kas nors kris).
    if (barcode && String(barcode).indexOf('TEST') !== 0) {
      upsertOrder({ order: orderName, tracking: barcode, locker: rec.locker, lockerId: rec.lockerId,
        km: rec.km, alt: rec.alt, customer: rec.customer, email: rec.email, phone: rec.phone,
        country: rec.country, address: rec.address, shipmentOk: '✅', status: 'Apdorojama' });
    }

    // 4. Lipdukas -> Google Drive (arba el. paštu, jei nustatyta).
    if (omnivaReady() && barcode && String(barcode).indexOf('TEST') !== 0) {
      try {
        rec.label = generateAndStoreLabel(orderName, barcode, cfg('LABEL_TO_EMAIL') || null);
      } catch (lErr) {
        rec.notes = 'Lipdukas: ' + lErr.message;
      }
    }

    // 5. Į Shopify rašom TIK LIVE (kad nesidubliuotų su Parcely).
    var shopifyMsg = '', shopifyOk = false;
    if (isLive() && shopifyReady() && order.id) {
      try {
        var km = locker.distance_km;
        var flag = (!picked.byCustomer && typeof km === 'number' && km > 15) ? '⚠️ ' : '';
        writeOrderDetails(order.id, {
          'Paštomatas': locker.name,
          'Paštomato adresas': locker.address,
          'Atstumas nuo kliento': flag + (km != null && km !== '' ? km + ' km' : '—'),
          'Pasirinko': picked.byCustomer ? 'Klientas (checkout)' : 'Auto – artimiausias',
          'Kiti artimi paštomatai': altShort,
          'Omniva tracking': barcode,
          'Tracking nuoroda': trackingUrl(barcode),
          'Lipdukas (PDF)': rec.label || '',
        });
        fulfillOrderWithTracking(order.id, barcode, trackingUrl(barcode));
        shopifyOk = true;
      } catch (sErr) {
        shopifyMsg = ' | Shopify: ' + sErr.message;
      }
    } else if (!isLive()) {
      shopifyMsg = ' | TEST šešėlis: Shopify neliestas (Parcely tvarko realų užsakymą)';
    }

    // Atskiri statusų langeliai
    rec.shipmentOk = barcode ? (simulated ? '🧪 TEST' : '✅') : '❌';
    rec.labelOk = rec.label ? '✅' : (omnivaReady() && !simulated ? '❌' : '—');
    rec.fulfilledOk = isLive() ? (shopifyOk ? '✅' : '❌') : '—';
    rec.status = simulated ? 'TEST' : 'Įvykdyta';
    rec.notes = (rec.notes ? rec.notes + ' | ' : '') +
      (simulated ? 'TEST režimas.' : 'Siunta + lipdukas sukurti.') + shopifyMsg;
    upsertOrder(rec);

    return { ok: true, order: orderName, locker: locker, tracking: barcode, label: rec.label || '', simulated: simulated };
  } catch (err) {
    rec.status = 'KLAIDA';
    rec.notes = String(err.message || err);
    upsertOrder(rec);
    return { ok: false, error: rec.notes, order: orderName };
  }
  } finally {
    try { _lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Užsakymas JAU turi Omniva siuntą (webhook'o kartojimas) — naujos NEkuriam.
 * Tik (per)bandom įrašyti tracking + įvykdyti Shopify, jei tai dar nepadaryta
 * (pvz. anksčiau krito dėl blogo Shopify token'o).
 */
function retryFulfillExisting(order, prev) {
  var orderName = prev['Užsakymas'] || order.name || '';
  var barcode = prev['Tracking'];
  var note = 'Kartotinis webhook\'as: jau turi siuntą ' + barcode + ' — nauja NEkurta.';
  var alreadyFulfilled = String(prev['Fulfilled Shopify'] || '').indexOf('✅') >= 0;
  if (isLive() && shopifyReady() && order.id && !alreadyFulfilled) {
    try {
      writeOrderDetails(order.id, {
        'Paštomatas': prev['Pastomatas'],
        'Atstumas nuo kliento': prev['km'] ? (prev['km'] + ' km') : '',
        'Kiti artimi paštomatai': prev['3 artimiausi'] || '',
        'Omniva tracking': barcode,
        'Tracking nuoroda': trackingUrl(barcode),
        'Lipdukas (PDF)': prev['Lipdukas'] || '',
      });
      fulfillOrderWithTracking(order.id, barcode, trackingUrl(barcode));
      upsertOrder({ order: orderName, fulfilledOk: '✅', status: 'Įvykdyta', notes: note + ' Shopify įvykdyta dabar.' });
      note += ' Shopify įvykdyta dabar.';
    } catch (e) {
      upsertOrder({ order: orderName, notes: note + ' Shopify vis tiek nepavyko: ' + e.message });
      note += ' Shopify vis tiek nepavyko: ' + e.message;
    }
  }
  return { ok: true, order: orderName, tracking: barcode, deduped: true, note: note };
}

/**
 * Pastomato parinkimas: kliento pasirinkimas (jei yra) > artimiausias.
 * Grąžina { locker, byCustomer } — byCustomer parodo, ar pasirinko pats klientas.
 */
function pickLocker(order, country, nearLockers) {
  var chosen = lockerFromOrder(order);
  if (chosen && chosen.raw) {
    var m = String(chosen.raw).match(/\b(\d{4,6})\b/);
    if (m) {
      var byId = lockerById(country, m[1]);
      if (byId) return { locker: byId, byCustomer: true };
    }
    var byName = lockerByName(country, chosen.raw);
    if (byName) return { locker: byName, byCustomer: true };
  }
  return { locker: nearLockers[0], byCustomer: false };
}

/** Paruošia Omniva.gs reikalingą order objektą. */
function toOmnivaOrder(rec, country, phone) {
  return {
    partner_shipment_id: rec.order,
    name: rec.customer,
    email: rec.email,
    phone: phone || rec.phone,
    country: country,
  };
}

/**
 * Telefono normalizacija Omniva validacijai (reikia šalies prefikso; Baltijos
 * šalims neleidžiami fiksuoto ryšio numeriai). Best-effort.
 */
function normalizePhone(raw, country) {
  if (!raw) return '';
  var p = String(raw).replace(/[^\d+]/g, '');
  if (p.indexOf('+') === 0) return p;
  var cc = { LT: '370', LV: '371', EE: '372' }[country] || '';
  if (p.indexOf('00') === 0) return '+' + p.slice(2);
  if (cc && p.indexOf(cc) === 0) return '+' + p;
  // LT vietinis formatas: 86xxxxxxx arba 6xxxxxxx
  if (country === 'LT') {
    if (p.indexOf('8') === 0) p = p.slice(1);
    return '+370' + p;
  }
  if (cc) return '+' + cc + p.replace(/^0/, '');
  return p;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2)).setMimeType(
    ContentService.MimeType.JSON
  );
}
