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
