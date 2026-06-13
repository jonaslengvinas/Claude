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
