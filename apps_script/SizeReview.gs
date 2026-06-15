/**
 * SizeReview.gs — Flyweight AI dydžių konsultacijos priėmimas.
 *
 * Srautas:
 *   Flyweight pokalbis (dydžio rekomendacija) → Shopify Flow (HTTP request)
 *   → ŠITAS endpoint'as → įrašo komentarą + statusą į „Orders" lentelę.
 *
 * SVARBU dėl gamybos saugumo:
 *   - Šis kelias NELIEČIA Omniva siuntų, fulfillment'o ar Shopify užsakymo.
 *   - Į lentelę rašom TIK du AI stulpelius (+ el. paštą, jei eilutė nauja).
 *     upsertOrder atnaujina tik perduotus laukus, tad esami užsakymo duomenys
 *     (pastomatas, tracking, būsena…) NEperrašomi.
 *   - Tagą `AI_SIZE_REVIEW` ir užsakymo pastabą Shopify pusėje deda Shopify Flow,
 *     ne šis kodas — taip atskiriam atsakomybes ir nereikia rašyti į Shopify iš čia.
 *
 * Laukiamas JSON (visi laukai neprivalomi, išskyrus order_number):
 *   {
 *     "action": "size_review",
 *     "order_number":     "#1234",
 *     "customer_email":   "klientas@pastas.lt",
 *     "product_type":     "Marškinėliai",
 *     "ordered_size":     "L",
 *     "recommended_size": "XL",
 *     "alternative_size": "L",
 *     "height":           "182 cm",
 *     "weight":           "95 kg",
 *     "fit_preference":   "regular",
 *     "body_shape_notes": "platesnis liemuo",
 *     "ai_reason":        "XL plotis 59.5 cm, L plotis 56.5 cm.",
 *     "chat_summary":     "...",
 *     "language":         "lt"
 *   }
 */

var AI_SIZE_STATUS = 'PATIKRINTI DYDĮ';

/**
 * Apdoroja vieną dydžių konsultacijos webhook'ą. Grąžina {ok, order, status}.
 * Kviečiama iš doPost (action=size_review).
 */
function handleSizeReview(p) {
  p = p || {};
  var orderName = String(p.order_number || p.order || '').trim();
  if (!orderName) {
    return { ok: false, error: 'trūksta order_number — be jo nerandam eilutės gamybos lentelėje' };
  }

  var comment = buildSizeComment(p);
  var rec = {
    order: orderName,
    aiSizeComment: comment,
    aiStatus: AI_SIZE_STATUS,
  };

  // El. paštą įrašom TIK jei eilutė dar nauja (kad neperrašytume jau esamo užsakymo
  // el. pašto kliento pokalbyje įvestu — jis gali skirtis nuo užsakymo).
  var existing = getOrder(orderName);
  if (!existing && p.customer_email) rec.email = String(p.customer_email).trim();

  var row = upsertOrder(rec);
  return {
    ok: true,
    order: orderName,
    status: AI_SIZE_STATUS,
    row: row,
    matchedExisting: !!existing,
    comment: comment,
  };
}

/**
 * Suformuoja žmogui skaitomą dydžio konsultacijos komentarą gamybos lentelei.
 * Praleidžia tuščius laukus, kad nesikauptų „—".
 */
function buildSizeComment(p) {
  var lines = ['AI dydžio konsultacija:'];

  var who = [p.height, p.weight].filter(Boolean).join(' / ');
  if (who) lines.push('Klientas: ' + who);
  if (p.fit_preference) lines.push('Fit: ' + p.fit_preference);
  if (p.body_shape_notes) lines.push('Kūno forma: ' + p.body_shape_notes);
  if (p.product_type) lines.push('Prekė: ' + p.product_type);
  if (p.ordered_size) lines.push('Užsakyta: ' + p.ordered_size);
  if (p.recommended_size) lines.push('AI rekomenduoja: ' + p.recommended_size);
  if (p.alternative_size) lines.push('Alternatyva: ' + p.alternative_size);
  if (p.ai_reason) lines.push('Priežastis: ' + p.ai_reason);
  if (p.chat_summary) lines.push('Pokalbio santrauka: ' + p.chat_summary);

  lines.push('Statusas: reikia peržiūrėti prieš gamybą.');
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  lines.push('(' + stamp + ')');

  return lines.join('\n');
}

/**
 * Greitas rankinis testas iš Apps Script redaktoriaus (Run → testSizeReview).
 * Įrašo bandomąją eilutę į lentelę — realaus užsakymo neliečia.
 */
function testSizeReview() {
  var res = handleSizeReview({
    action: 'size_review',
    order_number: '#TEST-SIZE',
    customer_email: 'testas@pastas.lt',
    product_type: 'Marškinėliai',
    ordered_size: 'L',
    recommended_size: 'XL',
    alternative_size: 'L',
    height: '182 cm',
    weight: '95 kg',
    fit_preference: 'regular',
    body_shape_notes: 'platesnis liemuo',
    ai_reason: 'XL plotis 59.5 cm, L plotis 56.5 cm.',
    chat_summary: 'Klientas dvejojo tarp L ir XL; pageidavo laisvesnio kirpimo.',
    language: 'lt',
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}
