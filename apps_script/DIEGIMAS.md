# Apps Script diegimas – žingsnis po žingsnio

Tikslas: paleisti `Code.gs` kaip Google Apps Script Web App, kad būtų pasiekiamas
internetu ir priimtų Shopify užsakymus. Nemokama, be serverio.

## 1. Sukurk projektą (geriausia – iš Google lentelės)
Kad veiktų užsakymų įrašymas į lentelę:
1. Sukurk naują **Google Sheets** lentelę (sheets.new).
2. Viršuje: **Extensions → Apps Script**.
3. Atsidariusiame redaktoriuje ištrink demo `function myFunction() {}`.
4. Įklijuok visą `Code.gs` turinį. **Išsaugok** (diskelio ikona).

(Jei nereikia lentelės – tiesiog eik į script.google.com → New project ir įklijuok.)

## 2. Pasitestuok redaktoriuje
1. Viršuje pasirink funkciją **`test`** ir paspausk **Run**.
2. Pirmą kartą paprašys leidimų (Authorize) – patvirtink savo Google paskyra.
3. Apačioje (Execution log) pamatysi rastus pastomatus. ✅

## 3. Deploy – padaryk pasiekiamą internetu
1. Viršuje dešinėje: **Deploy → New deployment**.
2. Prie „Select type" (krumpliaratis) pasirink **Web app**.
3. Nustatymai:
   - **Execute as:** Me (tavo paskyra)
   - **Who has access:** **Anyone** (kad Shopify galėtų pasiekti)
4. **Deploy** → nukopijuok **Web app URL** (baigiasi `/exec`).

## 4. Pasitestuok naršyklėje
Atidaryk (įrašyk savo URL):
```
<TAVO-WEB-APP-URL>?country=LT&postal=08217&city=Vilnius
```
Turi grąžinti artimiausią pastomatą su ID. 🎉

## 5. Prijunk Shopify (kai būsi pasiruošęs)
Shopify admin → **Settings → Notifications → Webhooks → Create webhook**:
- Event: **Order creation**
- Format: **JSON**
- URL: tavo Web App URL
Nuo tada kiekvienas užsakymas atkeliaus į programą, pastomatas bus parinktas ir
įrašytas į lentelės „Orders" lapą.

## 6. Omniva raktai (vėliau)
Kai gausi raktus: redaktoriuje **Project Settings (krumpliaratis) → Script Properties**
→ pridėk `OMNIVA_USERNAME`, `OMNIVA_PASSWORD`, `OMNIVA_CUSTOMER_CODE`. Tada
papildysim `doPost`, kad registruotų siuntą ir siųstų klientui tracking numerį.

## Pastabos
- **Atnaujinus kodą** reikia iš naujo **Deploy → Manage deployments → Edit → Deploy**
  (arba New version), kad pakeitimai įsigaliotų.
- Pastomatų sąrašas talpykloje atnaujinamas kas 6 val. automatiškai.
- Geokodavimas – Nominatim (nemokamas). Jei reiktų daugiau galios – galima vėliau
  perjungti į mokamą (Google/Mapbox).
