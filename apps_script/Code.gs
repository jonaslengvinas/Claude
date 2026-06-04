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
 */
function processOrder(order) {
  var a = order.shipping_address || {};
  var country = (a.country_code || cfg('SENDER_COUNTRY') || '').toUpperCase();
  var address = [a.address1, a.zip, a.city].filter(Boolean).join(', ');
  var orderName = order.name || String(order.id || '');

  // Bazinis įrašas į lentelę (kad matytųsi net jei toliau įvyks klaida).
  var rec = {
    order: orderName,
    customer: a.name || (order.customer && (order.customer.first_name + ' ' + order.customer.last_name)) || '',
    email: order.email || (order.customer && order.customer.email) || '',
    phone: a.phone || order.phone || '',
    country: country,
    address: address,
    status: 'Apdorojama',
  };

  try {
    // 2. Parenkam pastomatą: jei klientas pasirinko checkout'e — gerbiam jį;
    //    kitaip — artimiausias pagal adresą.
    var locker = resolveLocker(order, country, address);
    if (!locker) {
      rec.status = 'KLAIDA: nerastas pastomatas';
      rec.notes = 'Nepavyko nustatyti adreso koordinačių. Apdoroti rankiniu būdu.';
      upsertOrder(rec);
      return { ok: false, error: rec.notes, order: orderName };
    }
    rec.locker = locker.name;
    rec.lockerId = locker.id;
    rec.km = locker.distance_km || '';

    // 3. Sukuriam Omniva siuntą (jei LIVE ir yra raktai). TEST režime — imituojam.
    var barcode, simulated = false;
    if (isLive() && omnivaReady()) {
      var ship = registerShipment(toOmnivaOrder(order, rec, country), locker);
      barcode = ship.barcode;
    } else {
      simulated = true;
      barcode = 'TEST' + (order.id || Date.now());
    }
    rec.tracking = barcode;

    // 4. Įrašom pastomatą + tracking į Shopify, pažymim fulfilled
    //    -> Print Order Pro išsiunčia laišką su sąskaita + tracking.
    var shopifyMsg = '';
    if (shopifyReady() && order.id) {
      try {
        addLockerToOrder(order.id, locker.name + ' (' + locker.address + ')');
        if (!simulated || String(cfg('MODE')).toUpperCase() === 'LIVE') {
          fulfillOrderWithTracking(order.id, barcode, trackingUrl(barcode));
        }
      } catch (sErr) {
        shopifyMsg = ' | Shopify: ' + sErr.message;
      }
    } else {
      shopifyMsg = ' | Shopify praleista (nėra raktų arba order.id)';
    }

    rec.status = simulated ? 'TEST (imituota)' : 'Įvykdyta';
    rec.notes = (simulated ? 'TEST režimas — reali siunta nesukurta.' : 'Siunta sukurta, tracking įrašytas.') + shopifyMsg;
    upsertOrder(rec);

    return { ok: true, order: orderName, locker: locker, tracking: barcode, simulated: simulated };
  } catch (err) {
    rec.status = 'KLAIDA';
    rec.notes = String(err.message || err);
    upsertOrder(rec);
    return { ok: false, error: rec.notes, order: orderName };
  }
}

/** Pastomato parinkimas: kliento pasirinkimas > artimiausias pagal adresą. */
function resolveLocker(order, country, address) {
  var chosen = lockerFromOrder(order);
  if (chosen && chosen.raw) {
    // bandom rasti pagal ID skaičių tekste, kitaip naudojam tekstą kaip vardą
    var m = String(chosen.raw).match(/\b(\d{4,6})\b/);
    if (m) {
      var byId = lockerById(country, m[1]);
      if (byId) return byId;
    }
    // jei tik pavadinimas — vis tiek imam artimiausią, bet pažymim pasirinkimą
  }
  var res = findNearest(country, address, 1);
  if (res.error || !res.lockers || !res.lockers.length) return null;
  return res.lockers[0];
}

/** Paruošia Omniva.gs reikalingą order objektą. */
function toOmnivaOrder(order, rec, country) {
  return {
    partner_shipment_id: rec.order,
    name: rec.customer,
    email: rec.email,
    phone: rec.phone,
    country: country,
  };
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2)).setMimeType(
    ContentService.MimeType.JSON
  );
}
