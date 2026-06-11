/**
 * VIENKARTINIS Google Drive tvarkymo skriptas (2026-06-11 būsena).
 *
 * Ką daro: perkelia palaidus failus iš „My Drive" šaknies į projektų aplankus
 * (MG Drive/Setlistai, /Sutartys, /Marketingas, /Maketai, /Renginiai, /Audio
 * ir _Claude dokumentai). Trūkstamus aplankus sukuria. Nieko netrina.
 *
 * Kaip paleisti (5 min):
 *   1. script.google.com → New project → įklijuok šį failą.
 *   2. Paleisk funkciją perziuretiPlana() — tik išspausdina, KAS BUS perkelta (nieko nekeičia).
 *   3. Jei planas geras — paleisk tvarkytiDrive(). Pirmą kartą paprašys Drive leidimo.
 *   4. (nebūtina) parodykLikusiusSaknyje() — parodo, kas dar liko šaknyje nesutvarkyta.
 *
 * Pastaba: „Dekoras" skaičiuoklės priskirtos MG Drive/Renginiai — jei jos ne MG,
 * ištrink tas dvi eilutes prieš paleisdamas.
 */

var MG_DRIVE_ID = '1g2RkSlsBNtlwYyL7jfHPKAIiwwKcDSjC';

// [failoId, pavadinimas (tik logui), kelias]
var PLANAS = [
  // Setlistai / programos
  ['1GaGeECEjBlMUbE5nxy0u1N-jHEGGjKnxB3AK132kXcY', 'MG+Gi 06.26 Setlist',            'MG Drive/Setlistai'],
  ['1wbFUS1IV_7pxTnD-qZ9XIx4mFEN9oMnPuzECnmQ3wXo', 'MG+Gi 06.20 Setlist',            'MG Drive/Setlistai'],
  ['1UQoIYs_EHbB8VVdVKbFMZoxcP4b2xTLmvJY11JmQcq4', 'MG+Egle 06.12 LATIN FIESTA',     'MG Drive/Setlistai'],
  ['1bY-0C6NvGhMTlrN87i_U4M98r3eToY9lQ04I8dlNA7w', 'MG+Beatrice 07.10 Programa',     'MG Drive/Setlistai'],
  ['1Z854jboJCzwRvER8AzcU6GopCGzoNxaQIlk4cr-DscI', 'MG+Gintare 06.03 Country',       'MG Drive/Setlistai'],
  ['16eWu4OBDLvCpKNtkKrviaD3ajekJWtevSHVl5UmNoyY', 'MG+Milita 05.30 Siauliai',       'MG Drive/Setlistai'],
  ['14KJMcCyDwRAMC7plIV9H8kVyiENJCG9ZvvzbUbmNwXE', 'MG+Gintare 05.22 Karaoke',       'MG Drive/Setlistai'],
  ['17dtOlW8-2mzXRm889ULq7rXVU8-ksucOdKjqLUfncTI', 'MG+Gintare 05.22 Setlist',       'MG Drive/Setlistai'],
  // Sutartys
  ['1faH6ZL2Fv9221eQ_LM8dW9AjshE_t8i-',            'MG_Sutartis 08.07 Keite',        'MG Drive/Sutartys'],
  // Marketingas
  ['1ZgWFWm3qx-NybCylNkKfFkiGMcWCKGL6',            'MIDNIGHT-GENTS-KATALOGAS (v2)',  'MG Drive/Marketingas'],
  ['1XHLNMc4Ws0_XAfEQlkhRqPOfl2VY2XG_',            'MIDNIGHT-GENTS-KATALOGAS (v1)',  'MG Drive/Marketingas'],
  ['1mDcwcO8BJ8NeH80MEO9v2YGydTvzVcur',            'testimonials-20-new.json',       'MG Drive/Marketingas'],
  // Maketai (katalogo layout PDF)
  ['17XEh-neN6IMQf4wzmJrttZDbuUjOtvTR',            'Layout-A2-kompaktiskas (v2)',    'MG Drive/Maketai'],
  ['1sNWbjgzwAK_dJTkE2avKhOaa8QK5W4iu',            'Layout-A2-kompaktiskas (v1)',    'MG Drive/Maketai'],
  ['1Yi0aEthFmf5Xia0IcswyGuskVeidRHsj',            'Layout-A-originalo (v2)',        'MG Drive/Maketai'],
  ['10s9OGRgpc2SddNw_2H0NGLw11u-VJUyE',            'Layout-A-originalo (v1)',        'MG Drive/Maketai'],
  ['1m3Erm5hYpwUPx4_G4-V_LRYKuf-8DeTC',            'Layout-C-kortelinis',            'MG Drive/Maketai'],
  ['1fW3G8Y8AaAz8uYnrHqUB0XwkyoPpRbF-',            'Layout-B-minimalus',             'MG Drive/Maketai'],
  // Renginiai (jei „Dekoras" ne MG — ištrink šias dvi eilutes)
  ['1mxxq8xQGA_So88qrbo44T68vVFXn1SecvumsvkUNeGE', 'Dekoras 2026.06.06',             'MG Drive/Renginiai'],
  ['1YJGLpjRvnu-FdnoChUmD5f8U5l-i3EyCr5P0WhG6X9Q', 'Dekoras 2026.05.23',             'MG Drive/Renginiai'],
  // Audio
  ['1oxRbaBNQHzyVLXqdqA7eGCDA5d37DWG6',            '_AUDIO_tik_pavadinimai.txt',     'MG Drive/Audio'],
  // Claude dokumentai
  ['1SPMM-PrKoyX_SVEFz-BVRgszZ4z-qx57SKtug-H89y0', 'STRATEGIC-AUDIT-2026-05-08',     '_Claude dokumentai'],
  ['1_6aMa-OQNloR5NZux2KPgFaCeVRQxt1fQFDKdYKuVyc', 'INSTRUKCIJA-Krea',               '_Claude dokumentai'],
  ['1c8-iJ1UtG-9gkMR3tdfzuiPJbN_6fGO1Dwma4zkuxWo', 'CHROME-PERDAVIMAS',              '_Claude dokumentai'],
  ['13ZbO9hNk54Vrrz0GFtEpCk0LUHAlyg_lSZY1AePw75k', 'PRADZIA-CHROME-INSTRUKCIJA',     '_Claude dokumentai'],
  ['1EZHea_KsT2ijCTEMFAXOczB6LdAZKv9v50TCFqvUvtE', 'APPS-SCRIPT-V8-PATCH',           '_Claude dokumentai']
];

function perziuretiPlana() {
  PLANAS.forEach(function (e) {
    Logger.log('PERKELS: "%s"  →  %s', e[1], e[2]);
  });
  Logger.log('Iš viso failų: %s. Jei gerai — paleisk tvarkytiDrive().', PLANAS.length);
}

function tvarkytiDrive() {
  var perkelta = 0, klaidos = 0;
  PLANAS.forEach(function (e) {
    try {
      var failas = DriveApp.getFileById(e[0]);
      failas.moveTo(gautiArSukurtiAplanka(e[2]));
      Logger.log('OK: "%s" → %s', e[1], e[2]);
      perkelta++;
    } catch (err) {
      Logger.log('KLAIDA: "%s" — %s', e[1], err.message);
      klaidos++;
    }
  });
  Logger.log('Baigta: perkelta %s, klaidų %s.', perkelta, klaidos);
}

// Parodo, kas dar liko My Drive šaknyje (failai, ne aplankai).
function parodykLikusiusSaknyje() {
  var it = DriveApp.getRootFolder().getFiles();
  var n = 0;
  while (it.hasNext()) {
    var f = it.next();
    Logger.log('ŠAKNYJE LIKO: "%s" (%s)', f.getName(), f.getId());
    n++;
  }
  Logger.log(n === 0 ? 'Šaknis švari 🎉' : ('Liko failų: ' + n + ' — pasakyk Claude, kur juos dėti.'));
}

function gautiArSukurtiAplanka(kelias) {
  var dalys = kelias.split('/');
  var dabartinis = dalys[0] === 'MG Drive'
    ? DriveApp.getFolderById(MG_DRIVE_ID)
    : gautiArSukurtiSakninį(dalys[0]);
  for (var i = 1; i < dalys.length; i++) {
    var sub = dabartinis.getFoldersByName(dalys[i]);
    dabartinis = sub.hasNext() ? sub.next() : dabartinis.createFolder(dalys[i]);
  }
  return dabartinis;
}

function gautiArSukurtiSakninį(pavadinimas) {
  var it = DriveApp.getRootFolder().getFoldersByName(pavadinimas);
  return it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(pavadinimas);
}
