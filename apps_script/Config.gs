/**
 * Config.gs — visi nustatymai vienoje vietoje.
 *
 * Slapti raktai laikomi Apps Script "Script Properties" (Project Settings →
 * Script Properties), NE kode. Dashboard'o "Nustatymai" skiltis juos užpildo.
 *
 * Kodėl token'as, o ne HMAC? Apps Script Web App doPost() NEMATO HTTP antraščių,
 * todėl Shopify X-Shopify-Hmac-Sha256 patikrinti negalim. Vietoj to webhook'o
 * URL'e įdedam slaptą token'ą (?token=...), kurį Shopify visada nusiunčia, o mes
 * perskaitom iš e.parameter. Praktinis ir saugus sprendimas šitai platformai.
 */

/** Visi nustatymų raktai + ar jie slapti (slaptų reikšmės dashboard'e užmaskuojamos). */
var SETTINGS_KEYS = [
  // Veikimo režimas
  { key: 'MODE', label: 'Režimas (TEST / LIVE)', secret: false, group: 'Bendra' },

  // Shopify
  { key: 'SHOPIFY_SHOP', label: 'Shopify domenas (pvz. mano-parduotuve.myshopify.com)', secret: false, group: 'Shopify' },
  { key: 'SHOPIFY_ADMIN_TOKEN', label: 'Shopify Admin API token (shpat_...)', secret: true, group: 'Shopify' },
  { key: 'WEBHOOK_TOKEN', label: 'Webhook slaptas token (sugeneruok mygtuku)', secret: true, group: 'Shopify' },
  { key: 'NOTIFY_CUSTOMER', label: 'Ar Shopify pats siunčia laišką? (false = palieka Print Order Pro)', secret: false, group: 'Shopify' },
  { key: 'LOCKER_NOTE_FIELD', label: 'Užsakymo lauko pavadinimas pastomatui (note_attribute)', secret: false, group: 'Shopify' },

  // Omniva OMX API
  { key: 'OMNIVA_USERNAME', label: 'Omniva API vartotojas', secret: true, group: 'Omniva' },
  { key: 'OMNIVA_PASSWORD', label: 'Omniva API slaptažodis', secret: true, group: 'Omniva' },
  { key: 'OMNIVA_CUSTOMER_CODE', label: 'Omniva customerCode (partnerio kodas)', secret: false, group: 'Omniva' },
  { key: 'OMNIVA_AGENT_ID', label: 'Omniva X-Integration-Agent-Id (jei turi)', secret: false, group: 'Omniva' },
  { key: 'TRACKING_URL_TEMPLATE', label: 'Tracking nuorodos šablonas ({barcode})', secret: false, group: 'Omniva' },

  // Lipdukai / Drive
  { key: 'DRIVE_FOLDER', label: 'Google Drive aplankas lipdukams', secret: false, group: 'Lipdukai' },
  { key: 'LABEL_TO_EMAIL', label: 'Lipduką siųsti el. paštu (palik tuščią = saugot į Drive)', secret: false, group: 'Lipdukai' },
  { key: 'RETURN_DAYS', label: 'Grąžinimo terminas dienomis (pvz. 14)', secret: false, group: 'Lipdukai' },

  // Siuntėjo (tavo) adresas — Omniva to reikalauja siuntai
  { key: 'SENDER_NAME', label: 'Siuntėjo vardas / įmonė', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_PHONE', label: 'Siuntėjo telefonas (su šalies prefiksu, pvz. +37060000000)', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_EMAIL', label: 'Siuntėjo el. paštas', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_STREET', label: 'Siuntėjo gatvė', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_CITY', label: 'Siuntėjo miestas', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_POSTCODE', label: 'Siuntėjo pašto kodas', secret: false, group: 'Siuntėjas' },
  { key: 'SENDER_COUNTRY', label: 'Siuntėjo šalis (LT / LV / EE)', secret: false, group: 'Siuntėjas' },
];

/** Numatytosios reikšmės (jei Script Property dar neįrašyta). */
var DEFAULTS = {
  MODE: 'TEST',
  NOTIFY_CUSTOMER: 'false',
  LOCKER_NOTE_FIELD: 'Paštomatas',
  TRACKING_URL_TEMPLATE: 'https://www.omniva.lt/private/track_and_trace?barcode={barcode}',
  SENDER_COUNTRY: 'LT',
  DRIVE_FOLDER: 'Omniva lipdukai',
  RETURN_DAYS: '14',
};

function _props() {
  return PropertiesService.getScriptProperties();
}

/** Vienas nustatymas (su numatytąja reikšme jei tuščia). */
function cfg(key) {
  var v = _props().getProperty(key);
  if (v === null || v === '') return DEFAULTS.hasOwnProperty(key) ? DEFAULTS[key] : '';
  return v;
}

/** Ar dirbam LIVE režime? */
function isLive() {
  return String(cfg('MODE')).toUpperCase() === 'LIVE';
}

/** Ar yra visi Omniva raktai, kad galėtume kurti realią siuntą? */
function omnivaReady() {
  return !!(cfg('OMNIVA_USERNAME') && cfg('OMNIVA_PASSWORD') && cfg('OMNIVA_CUSTOMER_CODE'));
}

/** Ar yra Shopify raktai, kad galėtume rašyti tracking į užsakymą? */
function shopifyReady() {
  return !!(cfg('SHOPIFY_SHOP') && cfg('SHOPIFY_ADMIN_TOKEN'));
}

/** Įrašyti nustatymą (kviečiama iš dashboard'o). */
function saveSetting(key, value) {
  _props().setProperty(key, value);
  return true;
}

/** Įrašyti kelis nustatymus iš dashboard'o formos. */
function saveSettings(obj) {
  var p = _props();
  Object.keys(obj).forEach(function (k) {
    if (obj[k] !== '__UNCHANGED__') p.setProperty(k, obj[k]);
  });
  return true;
}

/** Grąžina nustatymus dashboard'ui (slaptus užmaskuoja). */
function getSettingsForUi() {
  var p = _props();
  return SETTINGS_KEYS.map(function (s) {
    var raw = p.getProperty(s.key);
    var val;
    if (s.secret) {
      val = raw ? '••••••••' : ''; // niekada nerodom slaptų reikšmių
    } else {
      val = raw === null ? (DEFAULTS[s.key] || '') : raw;
    }
    return { key: s.key, label: s.label, group: s.group, secret: s.secret, value: val, isSet: !!raw };
  });
}

/** Sugeneruoja atsitiktinį webhook token'ą ir įrašo. Grąžina jį dashboard'ui. */
function generateWebhookToken() {
  var token = Utilities.getUuid().replace(/-/g, '');
  _props().setProperty('WEBHOOK_TOKEN', token);
  return token;
}
