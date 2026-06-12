/**
 * Edit.gs — valdymas tiesiai Google lentelėje.
 *
 *  - Meniu "Omnibox" (onOpen): paruošti lentelę, įjungti trigerį, parodyti pulto URL.
 *  - "Pakeisti pastomatą" tiesiai eilutėje: į stulpelį "Naujas pastomatas" įrašai
 *    tikslų pastomato pavadinimą, į "Patvirtinti (OK)" įrašai OK -> automatiškai
 *    perparenkamas pastomatas, pergeneruojamas lipdukas, rezultatas rašomas į
 *    "Pakeitimo rezultatas".
 *
 * SVARBU: ši automatika kviečia Omniva/Drive, todėl reikia ĮDIEGIAMO onEdit
 * trigerio (paprastas onEdit neturi teisių). Įdiek vieną kartą per meniu
 * "Omnibox → Įjungti pastomato keitimo trigerį" (setupTriggers).
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Omnibox')
      .addItem('1. Paruošti lentelę (stulpelius)', 'setupSheet')
      .addItem('2. Įjungti pastomato keitimo trigerį', 'setupTriggers')
      .addSeparator()
      .addItem('Parodyti pulto (dashboard) URL', 'showDashboardUrl')
      .addToUi();
  } catch (e) {}
}

/** Įdiegia onEdit trigerį, kad veiktų „OK" lentelėje. */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  try { SpreadsheetApp.getUi().alert('Trigeris įjungtas ✅\nDabar lentelėje gali keisti pastomatą įrašant pavadinimą + OK.'); } catch (e) {}
  return true;
}

/** Parodo Web App (pulto) URL, jei jau padarytas Deploy. */
function showDashboardUrl() {
  var url = ScriptApp.getService().getUrl();
  var msg = url
    ? 'Tavo pulto URL:\n\n' + url + '\n\n(Webhook\'ui Shopify\'uje pridėk ?token=...)'
    : 'Dar nepadarytas Deploy. Eik: Deploy → New deployment → Web app.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/**
 * Įdiegiamas onEdit: reaguoja į "OK" stulpelyje "Patvirtinti (OK)".
 */
function onEditInstalled(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEET_NAME) return;
    if (e.range.getColumn() !== _col('Patvirtinti (OK)')) return;
    var row = e.range.getRow();
    if (row < 2) return;
    if (String(e.value || '').trim().toLowerCase() !== 'ok') return;

    var resCol = _col('Pakeitimo rezultatas');
    var orderName = sh.getRange(row, _col('Užsakymas')).getValue();
    var newName = sh.getRange(row, _col('Naujas pastomatas')).getValue();
    if (!newName) {
      sh.getRange(row, resCol).setValue('❌ Pirma įrašyk pastomato pavadinimą');
      sh.getRange(row, _col('Patvirtinti (OK)')).clearContent();
      return;
    }
    sh.getRange(row, resCol).setValue('⏳ Keičiama…');
    var r = reassignByName(orderName, newName);
    sh.getRange(row, resCol).setValue(
      r.ok ? ('✅ ' + r.locker + (r.label ? ' · lipdukas atnaujintas' : '')) : ('❌ ' + r.error)
    );
    sh.getRange(row, _col('Patvirtinti (OK)')).clearContent();
  } catch (err) {
    try { e.range.getSheet().getRange(e.range.getRow(), _col('Pakeitimo rezultatas')).setValue('❌ ' + err.message); } catch (_) {}
  }
}
