/**
 * Drive.gs — Omniva lipdukų (PDF) saugojimas Google Drive ir nuorodos grąžinimas.
 *
 * Srautas: requestLabel() iš Omniva grąžina base64 PDF -> įrašom į Drive aplanką
 * -> gaunam viešą (su nuoroda) URL -> jį įrašom į užsakymo eilutę / Shopify.
 */

/** Drive aplankas lipdukams: pirma pagal ID, kitaip pagal pavadinimą. */
function getLabelFolder() {
  var id = cfg('DRIVE_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); }
    catch (e) { throw new Error('Nepavyko atidaryti Drive aplanko pagal ID (' + id + '). Patikrink, ar turi prieigą.'); }
  }
  var name = cfg('DRIVE_FOLDER') || 'Omniva lipdukai';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/** Įrašo base64 PDF į Drive (failas pavadinamas pagal užsakymo nr), grąžina nuorodą. */
function saveLabelToDrive(orderName, barcode, base64pdf) {
  var folder = getLabelFolder();
  var base = String(orderName || ('Omniva_' + barcode)).replace(/[\\/:*?"<>|#]/g, '').trim();
  var fname = base + '.pdf';

  // jei tas pats užsakymas perdaromas — pašalinam seną to paties pavadinimo lipduką
  var old = folder.getFilesByName(fname);
  while (old.hasNext()) old.next().setTrashed(true);

  var blob = Utilities.newBlob(Utilities.base64Decode(base64pdf), 'application/pdf', fname);
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // jei organizacija draudžia viešą dalinimąsi — paliekam privatų, nuoroda veiks savininkui
  }
  return file.getUrl();
}

/**
 * Paima lipduką iš Omniva (base64) ir įrašo į Drive pagal užsakymo nr.
 * Grąžina Drive nuorodą. Jei toEmail nurodytas — Omniva nusiunčia el. paštu.
 */
function generateAndStoreLabel(orderName, barcode, toEmail) {
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
  return saveLabelToDrive(orderName, barcode, card.filedata);
}
