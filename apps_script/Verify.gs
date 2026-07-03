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
 * bet siunta JAU sukurta ir duomenys lentelėje. NEkuria naujos siuntos: paima
 * esamą tracking'ą, įrašo info į užsakymą ir pažymi „fulfilled" (atnaujina Shopify).
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

/**
 * „Nauja siunta" — tam PAČIAM užsakymui/klientui sukuria NAUJĄ Omniva siuntą
 * (naujas tracking kodas + naujas lipdukas) su tuo pačiu priskirtu pastomatu ir
 * kliento duomenimis. Sąmoningai APEINA dublikatų apsaugą (processOrder ją blokuotų).
 * Shopify: perrašo „Additional details" nauju kodu/lipduku ir atnaujina tracking
 * (jei jau įvykdyta) arba įvykdo (jei dar ne).
 */
function uiCreateNewShipment(orderName, notifyCustomer) {
  // Numatyta: PRANEŠTI klientui (naujas kodas/paštomatas jam svarbus).
  var notify = (notifyCustomer === false) ? false : true;
  var o = getOrder(orderName);
  if (!o) throw new Error('Užsakymas nerastas: ' + orderName);
  if (!omnivaReady()) throw new Error('Trūksta Omniva raktų (Nustatymai).');

  var locker = lockerById(o['Šalis'], o['Pastomato ID']);
  if (!locker) {
    throw new Error('Nepavyko rasti pastomato pagal ID „' + o['Pastomato ID'] + '". Perparink pastomatą ir bandyk vėl.');
  }

  var oldTracking = String(o['Tracking'] || '');

  var omnivaOrder = rowToOmnivaOrder(o);
  omnivaOrder.partner_shipment_id = String(o['Užsakymas'] || orderName) + '-' + String(Date.now()).slice(-4);

  var ship = registerShipment(omnivaOrder, locker);
  var barcode = ship.barcode;

  var labelUrl = '';
  try { labelUrl = generateAndStoreLabel(orderName, barcode, cfg('LABEL_TO_EMAIL') || null); } catch (e) {}

  upsertOrder({
    order: orderName, tracking: barcode, label: labelUrl,
    locker: locker.name, lockerId: locker.id,
    shipmentOk: '✅', labelOk: labelUrl ? '✅' : '❌', status: 'Įvykdyta',
    notes: 'NAUJA siunta rankiniu būdu. Senas kodas: ' + (oldTracking || '—') + ' → naujas: ' + barcode,
  });

  var shopifyMsg = 'Shopify neliestas (TEST arba be OrderID).';
  if (isLive() && shopifyReady() && o['OrderID']) {
    try {
      writeOrderDetails(o['OrderID'], {
        'Paštomatas': locker.name,
        'Paštomato adresas': locker.address,
        'Omniva tracking': barcode,
        'Tracking nuoroda': trackingUrl(barcode),
        'Lipdukas (PDF)': labelUrl || '',
      });
      setOmnivaTrackingOnShopify(o['OrderID'], barcode, trackingUrl(barcode), notify);
      shopifyMsg = 'Shopify tracking atnaujintas nauju kodu' + (notify ? ' · klientui pranešta.' : '.');
      upsertOrder({ order: orderName, fulfilledOk: '✅' });
    } catch (e) {
      shopifyMsg = 'Shopify klaida: ' + e.message;
    }
  }

  return { ok: true, tracking: barcode, oldTracking: oldTracking, label: labelUrl, shopify: shopifyMsg, orders: listOrders(200) };
}

/**
 * „Siunta man" — sukuria naują eilutę + Omniva siuntą, kuria bet kas iš bet kurio
 * paštomato gali atsiųsti tau siuntą į tavo paštomatą (RETURN_LOCKER, pvz. Jonažolių).
 * Nesusieta su užsakymu. Grąžina tracking + lipduko PDF nuorodą.
 */
function uiCreateInboundLabel(senderName, senderPhone) {
  var rl = cfg('RETURN_LOCKER');
  if (!rl) throw new Error('Nustatymuose nenurodytas tavo paštomatas (RETURN_LOCKER).');
  var country = cfg('SENDER_COUNTRY') || 'LT';
  var locker = /^\d+$/.test(String(rl).trim()) ? lockerById(country, rl) : lockerByName(country, rl);
  if (!locker) throw new Error('Tavo paštomatas nerastas: ' + rl);
  if (!omnivaReady()) throw new Error('Trūksta Omniva raktų (Nustatymai).');

  var ref = 'MAN-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd-HHmmss');
  var phone = senderPhone ? normalizePhone(senderPhone, country) : '';

  var ship = registerInboundShipment(locker, {
    ref: ref,
    senderName: senderName || 'Siuntėjas',
    senderPhone: phone,
  });
  var barcode = ship.barcode;

  var labelUrl = '';
  try { labelUrl = generateAndStoreLabel(ref, barcode, cfg('LABEL_TO_EMAIL') || null); } catch (e) {}

  upsertOrder({
    order: ref,
    customer: senderName || 'Siuntėjas',
    phone: phone,
    country: country,
    locker: locker.name,
    lockerId: locker.id,
    tracking: barcode,
    label: labelUrl,
    shipmentOk: '📥',
    labelOk: labelUrl ? '✅' : '—',
    status: 'Siunta man',
    notes: 'Įeinanti siunta: bet kas → tavo paštomatas „' + locker.name + '". Ref: ' + ref,
  });

  return { ok: true, tracking: barcode, label: labelUrl, locker: locker.name, ref: ref, orders: listOrders(200) };
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
