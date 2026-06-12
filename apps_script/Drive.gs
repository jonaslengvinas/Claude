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
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT); // pasiekiama bet kam su nuoroda
  } catch (e) {
    // jei organizacija draudžia viešą dalinimąsi — paliekam privatų, nuoroda veiks savininkui
  }
  return file.getUrl();
}

/**
 * Atsparus lipduko duomenų ištraukimas.
 * Omniva gali grąžinti arba base64 (filedata) arba pre-signed S3 URL.
 * Grąžina { type: 'base64'|'url', data: '...' } arba null.
 */
function extractLabelData(res) {
  if (!res) return null;
  var arr = res.successAddressCards || res.addressCards || [];
  if (arr.length && arr[0]) {
    var card = arr[0];
    if (card.filedata) return { type: 'base64', data: card.filedata };
    var url = card.fileUrl || card.url || card.labelUrl || card.documentUrl || card.mergedDocumentUrl;
    if (url) return { type: 'url', data: url };
  }
  if (res.filedata) return { type: 'base64', data: res.filedata };
  var topUrl = res.fileUrl || res.mergedDocumentUrl || res.url;
  if (topUrl) return { type: 'url', data: topUrl };
  return null;
}

/**
 * Paima lipduką iš Omniva ir įrašo į Drive pagal užsakymo nr.
 * Omniva LIVE grąžina pre-signed URL → atsisiunčiame PDF ir saugome.
 * Grąžina Drive nuorodą. Jei toEmail nurodytas — Omniva nusiunčia el. paštu.
 */
function generateAndStoreLabel(orderName, barcode, toEmail) {
  if (toEmail) {
    requestLabel([barcode], toEmail);
    return '';
  }
  var res = requestLabel([barcode], null);
  var label = extractLabelData(res);
  if (!label) {
    throw new Error('Negautas lipdukas. Omniva atsakymas: ' + JSON.stringify(res).slice(0, 400));
  }

  var pdfBase64;
  if (label.type === 'url') {
    // Omniva LIVE grąžina pre-signed S3 URL (galioja ~5 min) — atsisiunčiame iš karto
    var pdfResp = UrlFetchApp.fetch(label.data, { muteHttpExceptions: true });
    if (pdfResp.getResponseCode() !== 200) {
      throw new Error('Nepavyko atsisiųsti lipduko PDF (' + pdfResp.getResponseCode() + ')');
    }
    pdfBase64 = Utilities.base64Encode(pdfResp.getContent());
  } else {
    pdfBase64 = label.data;
  }

  return saveLabelToDrive(orderName, barcode, pdfBase64);
}
