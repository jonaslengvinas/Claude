/**
 * Test.gs — bandomųjų užsakymų generatorius.
 *
 * Leidžia iškart pamatyti, kaip duomenys iš užsakymo krenta į "Orders" lentelę ir
 * dashboard'ą — be Shopify webhook'o ir be realių pinigų. Naudoja tą pačią
 * processOrder() grandinę kaip realus užsakymas.
 *
 * TEST režime (rekomenduojama): jei yra Omniva raktai — sukuria realią TEST siuntą
 * (test-omx.omniva.eu) ir lipduką; jei raktų nėra — imituoja barcode. Realaus
 * Shopify užsakymo neliečia.
 */

/** Pavyzdiniai užsakymai (imituoja Shopify orders/paid struktūrą). */
function sampleOrders() {
  var n = '#DBM3' + String(Date.now()).slice(-3); // realaus formato testinis nr, pvz. #DBM3274
  return [
    {
      id: '', name: n, email: 'testas@pavyzdys.lt', phone: '860000001',
      shipping_address: { name: 'Testas Vilnietis', address1: 'Gedimino pr. 9', zip: '01103', city: 'Vilnius', country_code: 'LT', phone: '860000001' },
      line_items: [{ title: 'Bandomoji prekė', quantity: 1 }],
    },
    {
      id: '', name: n, email: 'test@piemers.lv', phone: '+37120000001',
      shipping_address: { name: 'Test Rīdzinieks', address1: 'Brīvības iela 30', zip: 'LV-1011', city: 'Rīga', country_code: 'LV', phone: '+37120000001' },
      line_items: [{ title: 'Bandomoji prekė', quantity: 1 }],
    },
    {
      id: '', name: n, email: 'test@naide.ee', phone: '+37250000001',
      shipping_address: { name: 'Test Tallinlane', address1: 'Narva mnt 7', zip: '10117', city: 'Tallinn', country_code: 'EE', phone: '+37250000001' },
      line_items: [{ title: 'Bandomoji prekė', quantity: 1 }],
    },
  ];
}

/** Sukuria bandomąjį užsakymą (0=LT, 1=LV, 2=EE) ir praleidžia per grandinę. */
function uiCreateTestOrder(idx) {
  var orders = sampleOrders();
  var i = Math.max(0, Math.min(orders.length - 1, Number(idx) || 0));
  _forceTestOmniva = true; // bandomasis užsakymas NIEKADA nekuria realios Omniva siuntos
  try {
    var result = processOrder(orders[i]);
  } finally { _forceTestOmniva = false; }
  return { result: result, orders: listOrders(200) };
}

/** Paleisk redaktoriuje (Run), jei nori greito testo be dashboard'o. */
function testCreateSampleLT() {
  var r = uiCreateTestOrder(0);
  Logger.log(JSON.stringify(r.result, null, 2));
}

/**
 * PILNAS LIPDUKO TESTAS — paleisk šitą (Run) arba per meniu.
 * Praleidžia testinį užsakymą per visą sistemą ir aiškiai parodo kiekvieną žingsnį:
 *   1) adresas -> artimiausias pastomatas
 *   2) Omniva siunta (barcode)
 *   3) lipdukas (PDF) -> Google Drive nuoroda
 * Testinio užsakymo id tuščias, todėl net LIVE režime Shopify NELIEČIAMAS.
 *
 * country: 'LT' (numatyta), 'LV' arba 'EE'.
 */
function testLabelFlow(country) {
  var map = { LT: 0, LV: 1, EE: 2 };
  var idx = map[String(country || 'LT').toUpperCase()] || 0;
  var order = sampleOrders()[idx];

  var log = [];
  function L(s) { log.push(s); Logger.log(s); }

  L('===== OMNIBOX LIPDUKO TESTAS =====');
  L('Režimas: ' + cfg('MODE') + ' | Omniva raktai: ' + (omnivaReady() ? 'yra' : 'NĖRA'));
  L('Užsakymas: ' + order.name + '  (' + order.shipping_address.country_code + ')');
  L('Adresas: ' + [order.shipping_address.address1, order.shipping_address.zip, order.shipping_address.city].join(', '));
  L('----------------------------------');

  _forceTestOmniva = true; // testas NIEKADA nekuria realios Omniva siuntos
  try { var res = processOrder(order); } finally { _forceTestOmniva = false; }

  if (res.ok) {
    L('1) Pastomatas: ' + (res.locker && res.locker.name) + ' (' + (res.locker && res.locker.distance_km) + ' km)');
    L('2) Siuntos kodas (barcode): ' + (res.tracking || '—'));
    if (res.label) {
      L('3) ✅ LIPDUKAS DRIVE: ' + res.label);
      L('   -> Atidaryk šią nuorodą — tai tavo PDF lipdukas.');
    } else {
      L('3) ⚠️ Lipdukas NESUKURTAS. Žr. „Pastabos" stulpelį lentelėje.');
    }
    L('----------------------------------');
    L(res.simulated ? 'BAIGTA (TEST imitacija).' : '✅ BAIGTA SĖKMINGAI. Patikrink Drive aplanką ir lentelę.');
  } else {
    L('❌ KLAIDA: ' + res.error);
  }

  // Parodom suvestinę pop-up'e, jei paleista iš lentelės
  try { SpreadsheetApp.getUi().alert(log.join('\n')); } catch (e) {}
  return res;
}

/** Meniu pagalbininkai (LT/LV/EE) — kad būtų patogu paleisti iš lentelės meniu. */
function testLabelFlowLT() { return testLabelFlow('LT'); }
function testLabelFlowLV() { return testLabelFlow('LV'); }
function testLabelFlowEE() { return testLabelFlow('EE'); }
