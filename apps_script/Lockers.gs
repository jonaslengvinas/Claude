/**
 * Lockers.gs — artimiausio Omniva pastomato parinkimas (LT / LV / EE).
 *
 * Adresas → koordinatės (Nominatim, nemokamai) → artimiausi pastomatai pagal
 * tiesų atstumą (haversine). Pastomatų sąrašas talpykloje 6 val.
 *
 * Svarbu: locker.id == Omniva offloadPostcode (būtent jo reikia siuntai sukurti).
 */

var LOCKERS_URL =
  'https://raw.githubusercontent.com/mijora/omniva-prestahop-1.7/master/locations.json';
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

/** Surasti pastomatą pagal pavadinimą (tikslus, tada „dalis pavadinimo"). */
function lockerByName(country, name) {
  if (!name) return null;
  var q = String(name).trim().toLowerCase();
  if (!q) return null;
  var lockers = getLockers((country || '').toUpperCase());
  for (var i = 0; i < lockers.length; i++) {
    if (lockers[i].name.toLowerCase() === q) return lockers[i];
  }
  for (var j = 0; j < lockers.length; j++) {
    if (lockers[j].name.toLowerCase().indexOf(q) >= 0) return lockers[j];
  }
  return null;
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
      id: r.ZIP, // == Omniva offloadPostcode
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

function round2(n) {
  return Math.round(n * 100) / 100;
}
