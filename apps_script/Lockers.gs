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
      name: String(r.NAME).replace(/\s*\(naujas!?\)/ig, '').trim(), // nuvalom Omniva „(naujas!)"
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
 * pastomatų), o GitHub veidrodis — pasenęs (~150). Todėl: kvietimas su User-Agent
 * (be jo serveris gali atmesti) + PILNUMO patikra (jei per mažai LT pastomatų —
 * šaltinis dalinis, bandom kitą; tik kraštutiniu atveju grąžinam dalinį).
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
      if (ltMachines >= 200) return arr;
      if (!fallback) fallback = arr;
    } catch (e) { /* bandom kitą */ }
  }
  if (fallback) return fallback;
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
