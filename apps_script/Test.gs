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
  var result = processOrder(orders[i]);
  return { result: result, orders: listOrders(200) };
}

/** Paleisk redaktoriuje (Run), jei nori greito testo be dashboard'o. */
function testCreateSampleLT() {
  var r = uiCreateTestOrder(0);
  Logger.log(JSON.stringify(r.result, null, 2));
}
