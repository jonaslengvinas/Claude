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
    try {
      var testOrder = { partner_shipment_id: 'HEALTHCHECK-' + Date.now(), name: 'Testas Testaitis', email: cfg('SENDER_EMAIL') || 'test@test.lt', phone: '+37060000000', country: 'LT' };
      var lk2 = getLockers('LT')[0];
      var ship = registerShipment(testOrder, lk2);
      if (ship.barcode) ok('Omniva siunta (TEST)', 'Gautas tracking: ' + ship.barcode);
      else fail('Omniva siunta (TEST)', 'siunta sukurta, bet negautas barcode: ' + JSON.stringify(ship.raw).slice(0, 200));
    } catch (e) { fail('Omniva siunta (TEST)', e.message); }
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
  var url = generateAndStoreLabel(barcode, cfg('LABEL_TO_EMAIL') || null);
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

/** Perparenka pastomatą jau sukurtai siuntai (changeLocker) ir pergeneruoja lipduką. */
function uiReassignLocker(orderName, lockerId) {
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas');
  var locker = lockerById(o['Šalis'], lockerId);
  if (!locker) throw new Error('Pastomatas nerastas: ' + lockerId);

  var barcode = o['Tracking'];
  var note = '';
  if (omnivaReady() && barcode && String(barcode).indexOf('TEST') !== 0) {
    changeLocker(barcode, rowToOmnivaOrder(o), locker); // tas pats barcode, naujas pastomatas
    try { var url = generateAndStoreLabel(barcode, cfg('LABEL_TO_EMAIL') || null); if (url) setLabelUrl(orderName, url); }
    catch (e) { note = ' (lipduko pergeneruoti nepavyko: ' + e.message + ')'; }
  } else {
    note = ' (TEST — Omniva siunta nekeista)';
  }
  if (isLive() && shopifyReady() && o['OrderID']) {
    try { addLockerToOrder(o['OrderID'], locker.name + ' (' + locker.address + ')'); } catch (e) {}
  }
  upsertOrder(Object.assign(rowToRec(o), { locker: locker.name, lockerId: locker.id, km: locker.distance_km,
    notes: 'Pastomatas pakeistas į ' + locker.name + note }));
  return { ok: true, orders: listOrders(200) };
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
    changeLocker(barcode, rowToOmnivaOrder(o, phone), locker); // pakeičia receiver (telefoną), tas pats barcode
    try { var url = generateAndStoreLabel(barcode, cfg('LABEL_TO_EMAIL') || null); if (url) setLabelUrl(orderName, url); } catch (e) {}
  }
  if (isLive() && shopifyReady() && o['OrderID']) {
    try { shopifyFetch('put', '/orders/' + o['OrderID'] + '.json', { order: { id: o['OrderID'], phone: phone } }); } catch (e) {}
  }
  upsertOrder(Object.assign(rowToRec(o), { phone: phone, notes: 'Telefonas pakeistas, lipdukas pergeneruotas. Tracking nepakito: ' + barcode }));
  return { ok: true, phone: phone, orders: listOrders(200) };
}

/** Lentelės eilutę paverčia rec objektu (upsert atnaujinimui). */
function rowToRec(o) {
  return {
    order: o['Užsakymas'], orderId: o['OrderID'], customer: o['Klientas'], email: o['El. paštas'],
    phone: o['Telefonas'], country: o['Šalis'], address: o['Adresas'], locker: o['Pastomatas'],
    lockerId: o['Pastomato ID'], km: o['km'], tracking: o['Tracking'], status: o['Būsena'],
    returned: o['Grąžinta'], label: o['Lipdukas'], alt: o['Alt pastomatai'], time: o['Laikas'],
  };
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
