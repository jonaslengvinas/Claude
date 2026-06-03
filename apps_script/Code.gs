/**
 * Omnibox – artimiausio Omniva pastomato parinkimas (LT / LV / EE).
 * Google Apps Script versija: deploy'inama kaip Web App, pasiekiama internetu.
 *
 * Ką daro:
 *   - doGet  : testavimui naršyklėje (?country=LT&postal=08217&city=Vilnius)
 *   - doPost : priima Shopify "Order creation" webhook'ą, parenka pastomatą,
 *              įrašo į Google lentelę. (Omniva lipduką prijungsim vėliau.)
 *
 * Geokodavimas – nemokamas Nominatim (OpenStreetMap). Iki ~1000 orderių/mėn pakanka.
 */

// Omniva pastomatų sąrašas (veikia be raktų). Gamyboje galima keisti į gyvą
// "https://www.omniva.lt/locations.json".
var LOCKERS_URL =
  'https://raw.githubusercontent.com/mijora/omniva-prestahop-1.7/master/locations.json';
var COUNTRIES = ['LT', 'LV', 'EE'];

/** Testavimas naršyklėje: <WebAppURL>?country=LT&postal=08217&city=Vilnius */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.country) {
    return _json({
      usage: 'Pridėk ?country=LT&postal=08217&city=Vilnius (arba &street=...)',
    });
  }
  var query = [p.street, p.postal, p.city].filter(Boolean).join(', ');
  return _json(findNearest(p.country, query, Number(p.limit || 3)));
}

/** Shopify "Order creation" webhook'as ateina čia. */
function doPost(e) {
  var order = JSON.parse(e.postData.contents);
  var a = order.shipping_address || {};
  var country = (a.country_code || '').toUpperCase();
  var query = [a.address1, a.zip, a.city, country].filter(Boolean).join(', ');

  var res = findNearest(country, query, 3);
  logToSheet(order, res);

  // VĖLIAU (kai turėsi Omniva raktus): užregistruoti siuntą su res.lockers[0].id
  // ir išsiųsti klientui tracking numerį.

  return _json({ ok: true, locker: (res.lockers && res.lockers[0]) || null });
}

/** Pagrindinė logika: adresas -> koordinatės -> artimiausi pastomatai. */
function findNearest(country, query, limit) {
  country = (country || '').toUpperCase();
  if (COUNTRIES.indexOf(country) < 0) return { error: 'unsupported country ' + country };

  var coords = geocode(query, country);
  if (!coords) return { error: 'could not geocode', query: query };

  var lockers = getLockers(country);
  lockers.forEach(function (l) {
    l.distance_km = round2(haversine(coords.lat, coords.lon, l.lat, l.lon));
  });
  lockers.sort(function (x, y) {
    return x.distance_km - y.distance_km;
  });
  return { geocode: coords, lockers: lockers.slice(0, limit || 3) };
}

/** Adresas -> {lat, lon} per Nominatim (nemokamai). */
function geocode(query, country) {
  var url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=' +
    country.toLowerCase() +
    '&q=' +
    encodeURIComponent(query);
  var resp = UrlFetchApp.fetch(url, {
    headers: { 'User-Agent': 'omnibox-locker-finder/1.0 (Omniva app)' },
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) return null;
  var data = JSON.parse(resp.getContentText());
  if (!data || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

/** Pastomatai vienai šaliai (parsiunčiama ir laikoma talpykloje 6 val.). */
function getLockers(country) {
  var cache = CacheService.getScriptCache();
  var key = 'lockers_' + country;
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  var raw = JSON.parse(UrlFetchApp.fetch(LOCKERS_URL).getContentText());
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
      id: r.ZIP, // == Omniva offloadPostcode (reikės lipdukui)
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

/** Įrašo užsakymą + priskirtą pastomatą į "Orders" lentelę (jei script susietas su Sheet). */
function logToSheet(order, res) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    var s = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
    if (s.getLastRow() === 0) {
      s.appendRow(['Laikas', 'Užsakymas', 'Klientas', 'Adresas', 'Pastomatas', 'Pastomato ID', 'km']);
    }
    var a = order.shipping_address || {};
    var l = (res.lockers && res.lockers[0]) || {};
    s.appendRow([
      new Date(),
      order.name || order.id || '',
      a.name || '',
      [a.address1, a.zip, a.city].filter(Boolean).join(', '),
      l.name || '',
      l.id || '',
      l.distance_km || '',
    ]);
  } catch (err) {
    // jei script nesusietas su lentele – tiesiog praleidžiam
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, 2)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Paleisk ŠITĄ rankiniu būdu redaktoriuje (mygtukas Run), kad pasitestuotum. */
function test() {
  Logger.log(JSON.stringify(findNearest('LT', 'Gedimino pr. 9, 01103, Vilnius', 3), null, 2));
  Logger.log(JSON.stringify(findNearest('LV', 'Ganību iela 69, Liepāja', 3), null, 2));
}
