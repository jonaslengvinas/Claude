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

var SHOPIFY_API_VERSION = '2024-10';

function shopifyBase() {
  return 'https://' + cfg('SHOPIFY_SHOP') + '/admin/api/' + SHOPIFY_API_VERSION;
}

/**
 * Grąžina galiojantį Shopify Admin API access token'ą.
 *  - Jei įvestas statinis SHOPIFY_ADMIN_TOKEN (legacy) — naudojam jį.
 *  - Kitaip iš Client ID + Secret automatiškai gaunam token'ą per Client Credentials
 *    Grant (galioja ~24 val.) ir laikom talpykloje. Token'o atnaujinti ranka nereikia.
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
 * Sujungia su esamais (neperrašo svetimų laukų). Tušti laukai praleidžiami,
 * kad nesikauptų šiukšlių.
 *
 * details pvyzdys:
 *   { 'Paštomatas': 'Kauno MAXIMA ...', 'Atstumas nuo kliento': '0.4 km', ... }
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
    if (byName[name]) byName[name].value = value;          // atnaujinam esamą
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
  var fos = getFulfillmentOrders(orderId);
  var open = fos.filter(function (f) {
    return f.status === 'open' || f.status === 'in_progress';
  });
  if (!open.length) throw new Error('Užsakymas neturi atvirų fulfillment orders (gal jau įvykdytas?).');

  var notify = String(cfg('NOTIFY_CUSTOMER')).toLowerCase() === 'true';
  var body = {
    fulfillment: {
      notify_customer: notify,
      tracking_info: { number: barcode, company: 'Omniva', url: trackUrl },
      line_items_by_fulfillment_order: open.map(function (f) {
        return { fulfillment_order_id: f.id };
      }),
    },
  };
  return shopifyFetch('post', '/fulfillments.json', body);
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
