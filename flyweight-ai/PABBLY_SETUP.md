# Pabbly konfigūracija — Flyweight dydžių konsultacija → lentelė

Kaip duomenys iškeliauja iš Flyweight (be mokamo custom dev) ir patenka į gamybos
lentelę. Pagrindas: **Flyweight Lead-Collect** persiunčia el. laišką su pokalbio
istorija → **Pabbly** apdoroja (ChatGPT išskaido į laukus) → **mūsų Apps Script**
įrašo eilutę(-es) į lentelę.

```
Flyweight Custom Routing „Dydžio konsultacija (jau užsakė)"
   └─ įjungtas „Collect lead and forward inquiry"
        └─ lead el. laiškas (kliento info + pokalbio istorija)
              └─ Pabbly Connect:
                   1) Trigger: Email Parser (gauna laišką)
                   2) ChatGPT: tekstą → JSON laukai (jei trūksta — palieka tuščią)
                   3) Filtras: ar tai dydžio konsultacija
                   4) HTTP POST → mūsų Apps Script (?action=size_review)
                        └─ Apps Script → eilutė(-ės) lentelėje „Konsultacijos"
```

> Kodėl per Apps Script, o ne tiesiai į Sheets? Mūsų Apps Script jau moka: kelias
> prekes paskaidyti į kelias eilutes (tas pats užsakymo nr.), uždėti statusą, o kai
> trūksta info — **vis tiek užregistruoti** eilutę su „TRŪKSTA INFO". Pabbly tik
> persiunčia JSON. (Galima ir tiesiai į Sheets — žr. „Alternatyva" apačioje.)

---

## ETAPAS 0 — pirma pažiūrim, ką Flyweight realiai atsiunčia

Prieš statant Pabbly, reikia pamatyti tikrą lead laišką. Tai nulems, ar ChatGPT
žingsnis būtinas, ar info jau tvarkinga ir galima tiesiai.

**Flyweight pusėje:**
1. Sukurk **Custom Routing** „Size consultation / size change" (intentas: dydis / dydžio keitimas).
2. Įjunk tam routing'ui **„Collect lead and forward inquiry"**.
3. Nustatyk **lead forwarding el. paštą** (kol kas — savo paštą testui).
4. Prompte (PROMPTAS.md, „CONSULTATION SUMMARY") botas jau formuoja santrauką —
   ji pateks į pokalbio istoriją laiške.
5. Atlik **testinį pokalbį** (apsimesk klientu, kuris jau užsakė) ir gauk laišką.

**Ką tikrinam gautame laiške:**
- Ar santrauka visada vienodos struktūros (laukai tie patys, ta pati tvarka)?
- Ar yra užsakymo nr. ir el. paštas?
- Kaip atrodo keli produktai?

➡️ Jei **stabilu** → ChatGPT žingsnio gali nereikėti (Pabbly „Text Parser" pakanka).
➡️ Jei **įvairuoja** → naudojam ChatGPT žingsnį (atsparus netvarkai). Rekomenduoju
   pradėti su ChatGPT — saugiau, vėliau galima supaprastinti.

---

## ETAPAS 1 — Pabbly workflow (testinis)

Pabbly Connect → **Create Workflow** → pavadink „Flyweight size review (TEST)".

### 1 žingsnis — Trigger: Email Parser
- App: **Email Parser** (Pabbly).
- Gausi unikalų adresą, pvz. `abc123@parser.pabblyconnect.com`.
- **Flyweight** lead forwarding paštą nustatyk į šitą adresą (arba savo Gmail'e
  padaryk auto-forward iš Flyweight laiškų į šį adresą).
- Atlik testinį pokalbį → Pabbly pagaus laišką (Subject, Body, From).

### 2 žingsnis — Action: OpenAI (ChatGPT)
- App: **OpenAI ChatGPT** → action **Chat Completions / Ask ChatGPT**.
- Prijunk savo OpenAI API raktą.
- **User/Prompt** lauke įdėk apačioje esantį „Parsinimo promptą" + įterpk laiško
  **Body** (pokalbio istorija) į pažymėtą vietą.
- Modelis: pigus pakanka (pvz. `gpt-4o-mini`).
- Rezultatas: **grynas JSON** tekstas.

### 3 žingsnis — Filter (kad nerašytų šiukšlių)
- App: **Filter** (Pabbly).
- Sąlyga: tęsti tik jei ChatGPT `status` ≠ `not_size_consultation`.
  (Jei pokalbis ne apie dydį — workflow sustoja.)

### 4 žingsnis — Action: HTTP POST į Apps Script
- App: **API by Pabbly** (arba „Webhook") → **POST**.
- URL: `TAVO-APPS-SCRIPT-WEB-APP-URL/exec?token=TAVO_TOKEN&action=size_review`
- Headers: `Content-Type: application/json`
- Body (raw / JSON): įdėk **ChatGPT JSON** rezultatą (visą).
- Apps Script JSON.parse'ina pats, paskaido prekes, įrašo eilutes ir grąžina `ok`.

> Statusą gauni atgal: `{ ok:true, count:2 }` arba `{ ok:true, logged:true,
> status:"TRŪKSTA INFO" }`. Pabbly gali tai parodyti / užfiksuoti.

---

## Parsinimo promptas ChatGPT žingsniui (įdėk į 2 žingsnį)

```text
You convert a chatbot sizing consultation into strict JSON for a production sheet.

INPUT: the full chat transcript / lead email is between <<< and >>>.

RULES
- Output ONLY valid JSON. No markdown, no comments, no extra text.
- Never invent data. If a value is not clearly present, omit it or use "".
- Detect whether this is actually a SIZE consultation. If not, set
  "status": "not_size_consultation" and leave everything else empty.
- If it IS a size consultation but order_number AND customer_email are both missing,
  set "status": "missing_info" and put a short note in "notes" describing what happened.
- If there are MULTIPLE products, put each one as a separate object in "items".
- Keep customer-level fields (height, weight, etc.) at the top level, not per item.

JSON SHAPE
{
  "action": "size_review",
  "status": "ok | missing_info | not_size_consultation",
  "order_number": "",
  "customer_email": "",
  "gender": "",
  "height": "",
  "chest": "",
  "weight": "",
  "body_shape_notes": "",
  "fit_preference": "",
  "chat_summary": "",
  "notes": "",
  "items": [
    {
      "product_type": "",
      "ordered_size": "",
      "recommended_size": "",
      "alternative_size": "",
      "ai_reason": ""
    }
  ]
}

TRANSCRIPT:
<<<
{{ čia įdėk laiško Body iš 1 žingsnio }}
>>>
```

---

## ETAPAS 2 — testavimas

1. **Apps Script pusė atskirai:** redaktoriuje paleisk `testSizeReview`,
   `testSizeReviewMulti`, `testSizeReviewMissing` → patikrink, kad lentelėje atsiranda
   1 / 2 / 1 (TRŪKSTA INFO) eilutės. (Prieš tai `setupSheet`, kad būtų „Pastabos" stulpelis.)
2. **Pabbly pilna grandinė:** atlik testinį Flyweight pokalbį → patikrink, ar laiškas
   atėjo, ChatGPT grąžino JSON, POST pavyko, lentelėje atsirado eilutė.
3. **Trūkstamos info testas:** pokalbis be užsakymo nr./el. pašto → lentelėje turi būti
   eilutė su „TRŪKSTA INFO" ir pastaba.
4. **Kelių prekių testas:** pokalbis dėl 2 prekių → 2 eilutės, tas pats užsakymo nr.

---

## Alternatyva — be ChatGPT / be Apps Script

- **Be ChatGPT:** jei ETAPE 0 pamatysi, kad Flyweight santrauka visada vienoda,
  vietoj ChatGPT naudok Pabbly **Text Parser** (ištraukia pagal raktažodžius). Pigiau,
  bet trapiau (sulūžta, jei formatas keičiasi).
- **Be Apps Script:** Pabbly gali rašyti tiesiai per **Google Sheets → Add New Row**.
  Keliom prekėm reikės **Iterator** (eina per `items`). Praradimas: statuso/registravimo
  logika persikelia į Pabbly (Router), o ne į vieną vietą (mūsų Apps Script).

Rekomendacija pradžiai: **ChatGPT + Apps Script** (atspariausia, logika vienoje vietoje).

---

## Laukų schema (kontraktas)

JSON, kurį Apps Script priima (visi neprivalomi; reikia bent `order_number` arba
`customer_email`, kitaip įrašoma „TRŪKSTA INFO"):

| Laukas | Aprašymas |
|--------|-----------|
| `order_number` | Užsakymo nr. (pvz. `#1234`) |
| `customer_email` | Kliento el. paštas |
| `gender`, `height`, `chest`, `weight` | Kliento duomenys |
| `body_shape_notes`, `fit_preference` | Kūno forma, pageidaujamas kirpimas |
| `chat_summary` | Pokalbio santrauka |
| `notes` | Ką ChatGPT pastebėjo / ko trūko |
| `status` | Jei nurodytas — rašomas į „AI statusas"; kitaip „PATIKRINTI DYDĮ" |
| `items[]` | Prekės: `product_type`, `ordered_size`, `recommended_size`, `alternative_size`, `ai_reason` |
