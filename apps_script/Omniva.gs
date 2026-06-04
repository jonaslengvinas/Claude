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

function omnivaBase() {
  return isLive() ? OMNIVA_BASES.live : OMNIVA_BASES.test;
}

/** Bendras POST į Omniva su Basic Auth. */
function omnivaPost(path, body) {
  if (!omnivaReady()) {
    throw new Error('Trūksta Omniva raktų (OMNIVA_USERNAME / PASSWORD / CUSTOMER_CODE).');
  }
  var token = Utilities.base64Encode(cfg('OMNIVA_USERNAME') + ':' + cfg('OMNIVA_PASSWORD'));
  var headers = { Authorization: 'Basic ' + token };
  if (cfg('OMNIVA_AGENT_ID')) headers['X-Integration-Agent-Id'] = cfg('OMNIVA_AGENT_ID');

  var resp = UrlFetchApp.fetch(omnivaBase() + path, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Omniva API klaida (' + code + '): ' + text);
  }
  return text ? JSON.parse(text) : {};
}

/** Sukuria B2C siuntą į pastomatą. Grąžina { barcode, raw }. */
function registerShipment(order, locker) {
  var receiver = {
    personName: order.name,
    address: {
      country: order.country,
      offloadPostcode: String(locker.id), // <-- pastomatas
    },
  };
  if (order.phone) receiver.contactMobile = order.phone;
  if (order.email) receiver.contactEmail = order.email;

  var sender = {
    personName: cfg('SENDER_NAME'),
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

/** Atsako struktūra įvairuoja — ištraukiam barcode kuo atspariau. */
function extractBarcode(res) {
  if (!res) return '';
  if (res.barcodes && res.barcodes.length) return res.barcodes[0];
  if (res.shipments && res.shipments.length) {
    var s = res.shipments[0];
    if (s.barcode) return s.barcode;
    if (s.barcodes && s.barcodes.length) return s.barcodes[0];
  }
  if (res.barcode) return res.barcode;
  return '';
}

/** Lipduko PDF. Be el. pašto grąžina base64 PDF atsakyme. */
function requestLabel(barcodes, toEmail) {
  var body = {
    customerCode: cfg('OMNIVA_CUSTOMER_CODE'),
    barcodes: barcodes,
    sendAddressCardTo: toEmail ? 'EMAIL' : 'RESPONSE',
  };
  if (toEmail) body.cardReceiverEmail = toEmail;
  return omnivaPost('/shipments/package-labels', body);
}

/** Siuntos sekimo įvykiai. */
function trackShipment(barcode) {
  var body = { customerCode: cfg('OMNIVA_CUSTOMER_CODE'), barcodes: [barcode] };
  return omnivaPost('/shipments/events', body);
}

/** Tracking nuoroda klientui (pagal šabloną). */
function trackingUrl(barcode) {
  return String(cfg('TRACKING_URL_TEMPLATE')).replace('{barcode}', encodeURIComponent(barcode));
}
