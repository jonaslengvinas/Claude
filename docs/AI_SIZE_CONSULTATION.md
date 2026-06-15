# AI dydžių konsultacija → gamybos lentelė

Šis dokumentas aprašo **1-ąjį etapą**: Flyweight Custom Route + Shopify Flow webhook
struktūrą, kuri perduoda AI dydžio rekomendaciją į Google Sheets gamybos lentelę
peržiūrai. **Dydis automatiškai NEKEIČIAMAS** — tik sukaupiama rekomendacija ir
pažymimas užsakymas, kad žmogus peržiūrėtų prieš gamybą.

## Srautas (saugus kelias)

```
Flyweight pokalbis (dydžio rekomendacija)
   └─► Flyweight Custom Route: paklausia ar užsakymas pateiktas + el. paštas + ar perduoti
        └─► Shopify Flow workflow
              ├─ Add order tag:  AI_SIZE_REVIEW
              ├─ Add order note: dydžio konsultacijos santrauka
              └─ Send HTTP request ──► Apps Script Web App (?action=size_review)
                                          └─► Orders lentelė:
                                                • „AI dydžio komentaras"  = santrauka
                                                • „AI statusas"           = PATIKRINTI DYDĮ
```

> Pabbly šiame kelyje **nebūtinas** — Shopify Flow HTTP request rašo tiesiai į Apps
> Script. Pabbly galima įterpti vėliau, jei prireiks papildomo apdorojimo (žr. apačią).

Atsakomybės atskirtos saugumui:
- **Shopify Flow** tvarko Shopify pusę (tag + order note) — tai jis daro natyviai.
- **Apps Script** rašo TIK į lentelę (du nauji stulpeliai). Naujas kodo kelias
  **neliečia** Omniva siuntų, fulfillment'o nei užsakymo duomenų. `upsertOrder`
  atnaujina tik perduotus laukus, todėl esamos užsakymo eilutės duomenys nedingsta.

---

## 1 dalis — Flyweight Custom Route

**Kur:** Flyweight → Routing → Custom → Add route

**Route pavadinimas:** `Size consultation / size change`

**Kada paleisti (trigger):** kai pokalbis liečia dydį, dydžio keitimą ar „netinka dydis".

**Route instrukcija (įklijuok):**

```text
You are wrapping up a sizing conversation. Follow these steps IN ORDER and keep
replies short. Match the customer's language (LT / LV / EE / EN).

1. Confirm the recommendation in ONE sentence (recommended size + short reason
   using cm widths).

2. Ask: "Ar užsakymą jau pateikėte, ar dar tik renkatės dydį?"
   - If the customer is still choosing: thank them, do NOT collect order data, end.
   - If the order is already placed: continue.

3. Ask: "Įveskite el. pašto adresą, kuriuo atlikote užsakymą."
   (and, if possible, the order number, e.g. #1234)

4. Ask: "Ar norite, kad perduočiau šią dydžio rekomendaciją mūsų komandai peržiūrai?"
   - If yes: trigger the order-management / Shopify Flow action with the collected
     fields (see schema). Then confirm: "Perdaviau rekomendaciją komandai peržiūrai.
     Prieš gamybą ją patikrins žmogus."

IMPORTANT — never promise that the size was changed automatically. The size is only
flagged for human review before production. Do not invent measurements; if unsure,
say the team will verify.
```

**Daugiakalbiai patvirtinimo tekstai** (jei nori fiksuotų):

| Kalba | „Perdavėme komandai peržiūrai" |
|-------|--------------------------------|
| LT | Perdaviau rekomendaciją komandai peržiūrai. Prieš gamybą ją patikrins žmogus. |
| LV | Nodevu ieteikumu mūsu komandai pārskatīšanai. Pirms ražošanas to pārbaudīs darbinieks. |
| EE | Edastasin soovituse meeskonnale ülevaatamiseks. Enne tootmist vaatab selle inimene üle. |
| EN | I've passed the recommendation to our team for review. A person will check it before production. |

---

## 2 dalis — Webhook struktūra (laukų kontraktas)

Tai bendras JSON, kurį siunčia Shopify Flow (arba Pabbly) į Apps Script. Visi laukai
neprivalomi, **išskyrus `order_number`** (be jo nerandam eilutės lentelėje).

```json
{
  "action": "size_review",
  "order_number": "#1234",
  "customer_email": "klientas@pastas.lt",
  "product_type": "Marškinėliai",
  "ordered_size": "L",
  "recommended_size": "XL",
  "alternative_size": "L",
  "height": "182 cm",
  "weight": "95 kg",
  "fit_preference": "regular",
  "body_shape_notes": "platesnis liemuo",
  "ai_reason": "XL plotis 59.5 cm, L plotis 56.5 cm.",
  "chat_summary": "Klientas dvejojo tarp L ir XL.",
  "language": "lt"
}
```

**Atsakymas (200):**

```json
{ "ok": true, "order": "#1234", "status": "PATIKRINTI DYDĮ", "matchedExisting": true }
```

Jei `order_number` neperduotas → `{ "ok": false, "error": "trūksta order_number ..." }`.

---

## 3 dalis — Shopify Flow workflow

**Kur:** Shopify admin → Flow → Create workflow

- **Trigger:** užsakymo pažymėjimas, kurį paleidžia Flyweight order-management veiksmas
  (pvz. „Order tags added" su tagu, kurį uždeda Flyweight), arba tiesioginis Flyweight
  → Flow trigeris, jei jūsų plane jis yra.
- **Action 1 — Add order tags:** `AI_SIZE_REVIEW`
- **Action 2 — Add order note** (timeline komentaras): dydžio konsultacijos santrauka.
- **Action 3 — Send HTTP request:**
  - Method: `POST`
  - URL: `https://script.google.com/macros/s/XXXX/exec?token=WEBHOOK_TOKEN&action=size_review`
    (tas pats Web App URL ir token kaip Omniva webhook'e — žr. `WEBHOOK_TOKEN` dashboard'e)
  - Headers: `Content-Type: application/json`
  - Body: JSON pagal aukščiau esantį kontraktą, sumapinant Flow kintamuosius, pvz.:

```json
{
  "action": "size_review",
  "order_number": "{{ order.name }}",
  "customer_email": "{{ order.email }}",
  "product_type": "{{ ... }}",
  "ordered_size": "{{ ... }}",
  "recommended_size": "{{ ... }}",
  "alternative_size": "{{ ... }}",
  "height": "{{ ... }}",
  "weight": "{{ ... }}",
  "fit_preference": "{{ ... }}",
  "body_shape_notes": "{{ ... }}",
  "ai_reason": "{{ ... }}",
  "chat_summary": "{{ ... }}",
  "language": "{{ ... }}"
}
```

> Dydžio laukus (`recommended_size`, `ai_reason` ir t. t.) tiekia Flyweight. Jei Shopify
> Flow negaus visos chat santraukos patogiai, ją perduokit per Flyweight lead forwarding
> arba tiesiai iš Flyweight į šį Apps Script URL (tas pats `?action=size_review`).

---

## 4 dalis — Apps Script pusė (jau įdiegta šiame projekte)

Pakeitimai:
- `Sheet.gs` — du nauji stulpeliai gale: **„AI dydžio komentaras"** ir **„AI statusas"**.
  Pridėti gale, kad esami stulpeliai nepasislinktų. Paleisk lentelės meniu
  **„Paruošti lentelę"** (`setupSheet`), kad antraštės atsirastų.
- `Code.gs` `doPost` — naujas kelias: `?action=size_review` (arba `action` payload'e)
  nukreipia į `handleSizeReview`. Visa kita lieka kaip buvo (užsakymų srautas neliestas).
- `SizeReview.gs` — `handleSizeReview` + `buildSizeComment` + `testSizeReview`.

**Testas be Shopify:** Apps Script redaktoriuje paleisk `testSizeReview` — į lentelę
įrašys eilutę `#TEST-SIZE` su komentaru ir statusu `PATIKRINTI DYDĮ`.

**Komentaro pavyzdys lentelėje:**

```text
AI dydžio konsultacija:
Klientas: 182 cm / 95 kg
Fit: regular
Kūno forma: platesnis liemuo
Prekė: Marškinėliai
Užsakyta: L
AI rekomenduoja: XL
Alternatyva: L
Priežastis: XL plotis 59.5 cm, L plotis 56.5 cm.
Statusas: reikia peržiūrėti prieš gamybą.
(2026-06-15 12:30)
```

> **Svarbu:** pakeitus Apps Script kodą, reikia **Deploy → Manage deployments → Edit →
> New version → Deploy**, kad įsigaliotų webhook'e.

---

## Pasirinktinai — Pabbly tarpinis sluoksnis (vėliau)

Jei prireiks (pvz. siųsti į kelias vietas, transformuoti laukus, spalvinti eilutes per
kitą įrankį), Shopify Flow gali siųsti į Pabbly webhook'ą, o Pabbly toliau į šį patį
Apps Script URL su tuo pačiu JSON kontraktu. Apps Script pusė nesikeičia.

## Tolesni etapai (iš strategijos)

1. ✅ Flyweight Custom Route + webhook struktūra (šis dokumentas).
2. Apps Script: jei reikia spalvinti/stabdyti gamybą pagal `AI statusas` — galima pridėti
   `onEdit`/formato taisyklę (6 etapas).
3. Testuoti su testiniu užsakymu (B scenarijus DIEGIMAS.md'e).
4. Tik po 10–20 realių pokalbių spręsti dėl automatinio dydžio keitimo (rizikingas kelias).
