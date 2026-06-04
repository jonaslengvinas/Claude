# Omnibox v1 — diegimas žingsnis po žingsnio

Tikslas: paleisti automatinę grandinę — **klientas apmoka užsakymą → programa parenka
artimiausią Omniva pastomatą → sukuria Omniva siuntą (tracking) → įrašo tracking ir
pastomatą į Shopify užsakymą → Print Order Pro išsiunčia klientui laišką su sąskaita
ir tracking kodu.** Viskas sukasi nemokamame Google Apps Script + Google Sheets.

> Srautas pasirinktas: **siunta kuriama iškart po apmokėjimo**, **laišką klientui
> siunčia Print Order Pro** (atskiro laiško programa nesiunčia — taip išvengiam dvigubų).

## 1. Sukurk projektą iš Google lentelės
1. Sukurk naują **Google Sheets** lentelę → [sheets.new](https://sheets.new)
2. Viršuje: **Extensions → Apps Script**
3. Ištrink demo `myFunction()`.
4. Įkelk visus failus iš `apps_script/`: `Code.gs`, `Config.gs`, `Lockers.gs`,
   `Omniva.gs`, `Shopify.gs`, `Sheet.gs`, `Verify.gs`, ir `Dashboard.html`
   (`+ → HTML` failui sukurti, pavadink **Dashboard**). **Išsaugok.**

## 2. Deploy — padaryk pasiekiamą internetu
1. **Deploy → New deployment** → tipas **Web app**
2. **Execute as:** Me · **Who has access:** **Anyone**
3. **Deploy** → nukopijuok **Web app URL** (baigiasi `/exec`)
4. Atidaryk tą URL naršyklėje → pamatysi **dashboard'ą** 🎉

## 3. Suvesk nustatymus (dashboard → „Nustatymai")
Užpildyk laukus ir spausk **💾 Išsaugoti**:

**Shopify**
- `SHOPIFY_SHOP` — `tavo-parduotuve.myshopify.com`
- `SHOPIFY_ADMIN_TOKEN` — Admin API token (žr. žemiau, kaip gauti)
- `WEBHOOK_TOKEN` — spausk **🔑 Naujas webhook token** (sugeneruos automatiškai)
- `NOTIFY_CUSTOMER` — palik `false` (laišką siunčia Print Order Pro, ne Shopify)

**Omniva** (kai gausi raktus iš Omniva)
- `OMNIVA_USERNAME`, `OMNIVA_PASSWORD`, `OMNIVA_CUSTOMER_CODE`, (`OMNIVA_AGENT_ID`)

**Siuntėjas** (tavo adresas — Omniva to reikalauja siuntai)
- `SENDER_NAME`, `SENDER_PHONE`, `SENDER_EMAIL`, `SENDER_STREET`, `SENDER_CITY`,
  `SENDER_POSTCODE`, `SENDER_COUNTRY`

**Bendra**
- `MODE` — `TEST` testavimui, `LIVE` realiems siuntimams

### Kaip gauti Shopify Admin API token
Shopify admin → **Settings → Apps and sales channels → Develop apps → Create an app**
→ **Configure Admin API scopes** → įjunk: `read_orders`, `write_orders`,
`write_merchant_managed_fulfillment_orders`, `read_fulfillments`, `write_fulfillments`
→ **Install app** → nukopijuok **Admin API access token** (`shpat_...`).

## 4. Patikrink, ar viskas veikia (dashboard → „Patikrinimas")
Spausk **▶ Patikrinti**. Pamatysi grandinę su ✅ / ⚠️ / ❌:
lentelė · pastomatų sąrašas · adreso→pastomato paieška · Shopify ryšys ·
Omniva TEST siunta · webhook token · siuntėjo adresas.
Taisyk ❌, kol viskas žalia. **TEST režime reali siunta nesukuriama.**

## 5. Prijunk Shopify webhook'ą
Shopify admin → **Settings → Notifications → Webhooks → Create webhook**:
- Event: **Order payment** (`orders/paid`)
- Format: **JSON**
- URL: `TAVO-WEB-APP-URL?token=TAVO_WEBHOOK_TOKEN`
  (token'ą matai dashboard'e paspaudus „Naujas webhook token")

Nuo dabar kiekvienas **apmokėtas** užsakymas automatiškai apdorojamas ir atsiranda
dashboard'o „Užsakymai" skiltyje.

## 6. Perjunk į LIVE
Kai patikra žalia ir turi Omniva raktus: nustatymuose `MODE = LIVE` → Išsaugoti →
**Deploy → Manage deployments → Edit → New version → Deploy**.

---

## Kasdienis naudojimas
- **Užsakymai** — visi užsakymai, pastomatas, tracking, būsena.
- **Grąžinimai** — siuntos kuriamos su `returnAllowed`, čia žymi grąžintus.
- **Patikrinimas** — bet kada patikrink sistemą.
- **Nustatymai** — keisk raktus / režimą.
- **Eksportas** — pati Google lentelė: **File → Download → CSV / Excel**.

## Svarbu
- **Pakeitus kodą** reikia iš naujo **Deploy → New version**, kad įsigaliotų.
- Apps Script Web App **nemato HTTP antraščių**, todėl saugumui naudojam slaptą
  `?token=` URL'e (ne HMAC). Laikyk token'ą paslaptyje; prireikus — sugeneruok naują.
- Kad **pastomato pavadinimas matytųsi Print Order Pro laiške**, jo šablone parodyk
  užsakymo `note_attribute` lauką „**Paštomatas**" (programa jį ten įrašo).
- Pastomatų sąrašas talpykloje atnaujinamas kas 6 val. automatiškai.
- Geokodavimas — Nominatim (nemokamas, iki ~1000 užsak./mėn pakanka).
