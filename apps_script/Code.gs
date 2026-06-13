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
        // ⚠️ žyma, jei pastomatą priskyrė sistema (klientas nepasirinko) ir jis toli
        // — gali reikšti netikslų adresą; verta peržiūrėti rankiniu būdu.
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
}

/**
 * Pastomato parinkimas: kliento pasirinkimas (jei yra) > artimiausias.
 * Grąžina { locker, byCustomer } — byCustomer parodo, ar pastomatą pasirinko
 * pats klientas checkout'e (true), ar sistema priskyrė artimiausią (false).
 */
function pickLocker(order, country, nearLockers) {
  var chosen = lockerFromOrder(order);
  if (chosen && chosen.raw) {
    var m = String(chosen.raw).match(/\b(\d{4,6})\b/);
    if (m) {
      var byId = lockerById(country, m[1]);
      if (byId) return { locker: byId, byCustomer: true };
    }
    var byName = lockerByName(country, chosen.raw); // jei checkout'e saugomas pavadinimas, ne ID
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
