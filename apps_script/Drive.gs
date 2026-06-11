/**
 * Drive.gs — Omniva lipdukų (PDF) saugojimas Google Drive ir nuorodos grąžinimas.
 *
 * Srautas: requestLabel() iš Omniva grąžina base64 PDF -> įrašom į Drive aplanką
 * -> gaunam viešą (su nuoroda) URL -> jį įrašom į užsakymo eilutę / Shopify.
 */

/** Drive aplankas lipdukams (sukuriamas jei nėra). */
function getLabelFolder() {
  var name = cfg('DRIVE_FOLDER') || 'Omniva lipdukai';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/** Įrašo base64 PDF į Drive, grąžina nuorodą (peržiūrai su nuoroda). */
function saveLabelToDrive(barcode, base64pdf) {
  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64pdf),
    'application/pdf',
    'Omniva_' + barcode + '.pdf'
  );
  var file = getLabelFolder().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // jei organizacija draudžia viešą dalinimąsi — paliekam privatų, nuoroda vis tiek veiks savininkui
  }
  return file.getUrl();
}

/**
 * Paima lipduką iš Omniva (base64) ir įrašo į Drive. Grąžina Drive nuorodą.
 * Jei toEmail nurodytas — Omniva nusiunčia lipduką el. paštu (į Drive nededam).
 */
function generateAndStoreLabel(barcode, toEmail) {
  if (toEmail) {
    requestLabel([barcode], toEmail);
    return ''; // išsiųsta el. paštu, Drive nuorodos nėra
  }
  var res = requestLabel([barcode], null); // RESPONSE -> base64 PDF
  var card = (res.successAddressCards && res.successAddressCards[0]) || null;
  if (!card || !card.filedata) {
    var failed = res.failedAddressCards ? JSON.stringify(res.failedAddressCards) : JSON.stringify(res).slice(0, 200);
    throw new Error('Negautas lipdukas: ' + failed);
  }
  return saveLabelToDrive(barcode, card.filedata);
}
