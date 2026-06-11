# 📊 DASHBOARD — visų darbų būsena

> Atnaujinta: **2026-06-11 vakaras**.
> Atnaujinti: bet kuriame Claude Code pokalbyje parašyk `/dashboard`.
> Šis failas internete: `github.com/jonaslengvinas/Claude` → šaka `claude/gracious-johnson-r9eq3w` → `DASHBOARD.md`.

## Bendras vaizdas

| Projektas | Būsena | Kitas žingsnis | Kieno eilė |
|---|---|---|---|
| **DBM / Omnibox** | 🟡 raktai gauti, programa dar neįdiegta | Įdiegti v1 kartu su Claude (~30–45 min, be terminalo) | **JONO + Claude** |
| **MG svetainė** | 🟢 auditas įgyvendintas (Jonas, 06-11) | Tik smulkūs pakeitimai pagal poreikį | — |
| **MB buhalterija** | 🟢 veikia (patikrinta 06-11) | Įjungti kasdienę peržiūrą + įkelti banko išrašą | **JONO** (5 min) |
| **Drive tvarka** | 🟡 skriptas paruoštas | Paleisti `tools/drive_tvarkymas.gs` | **JONO** (5 min) |

## 🔴 Laukia TAVO veiksmo / sprendimo

1. **DBM diegimas** *(~30–45 min kartu su Claude)*
   Programa, kurios nori (užsakymų lentelė Google Sheets + lipduko nuoroda + tracking), **jau parašyta** (`apps_script/`), bet dar neįdiegta tavo Google paskyroje — todėl jos nematai. Atsidaryk naują Claude Code sesiją ir parašyk: *„Diegiame DBM programą pagal apps_script/DIEGIMAS.md — vesk mane žingsnis po žingsnio."* Pabaigoje įvesi Omniva raktus (Nustatymai → Omniva, customerCode `8206765`) ir paspausi Health check.
   🔐 Raktai laikomi TIK Script Properties; chat'u siųstą slaptažodį vėliau verta pasikeisti per Omniva.

2. **MB kasdienė peržiūra — įjungti** *(2 min)*
   Sukurtas skill'as `mb-lengvina-daily-review` (Drive aplankas `18xpe5PaJ8BLfdJU8GL8e1bLZ8RmkRfSP`, šalia veikiančio hourly-sync). Claude app → **Routines** → pridėk jį kasdieniam paleidimui (pvz. 18:00).

3. **MB banko suderinimas — įkelti išrašą**
   Įkelk birželio banko išrašą į `Banko transakcijos 2026-06` ir pasakyk bet kuriame chate — Claude padarys suderinimo ataskaitą: kurios sąskaitos apmokėtos, kurios laukia.

4. **Drive tvarkymas** *(5 min)* — paleisti `tools/drive_tvarkymas.gs` (instrukcija failo viršuje; „Dekoras" eilutes ištrink, jei tai ne MG).

5. **Parcely vs tiesioginis OMX** — spręsim po TEST diegimo (v1 jau daro tiesiogiai, Parcely lieka atsarga).
6. **Viešas Shopify app'sas** — atidėta, kol DBM flow veiks sau (`docs/BUSINESS_RESEARCH.md`).

## 🗂 Neužbaigti darbai (backlog)

### DBM / Omnibox
- [ ] Įdiegti v1 Apps Script (→ užsakymų lentelė, lipdukai, web dashboardas) — *~45 min su Jonu*
- [ ] TEST siunta + Health check (po diegimo) — *~15 min*
- [ ] LIVE perjungimas, Parcely fallback — *po sėkmingo TEST*
- [ ] Lockerių dataseto auto atnaujinimas — *~1 val.*

### MG
- [x] Audito rekomendacijos įgyvendintos (Jonas kitame chate, 06-11) — projektas uždarytas, liko tik ad hoc smulkmenos

### MB Lengvina
- [x] Sync patikrintas 06-11: veikia (06:48 suklasifikavo 3 sąskaitas su tvarkingais pavadinimais)
- [x] Praleista IRE26_05037 (30.15 €, data 2026-05-31) rasta ir įkelta į `Įmonės pirkimai 2026-05`
- [x] Sukurtas kasdienės peržiūros skill'as (saugiklis nuo praleidimų + ranka įkeltų sąskaitų priskyrimas + ataskaita)
- [ ] Įjungti daily-review kaip Routine — **JONO**
- [ ] Banko išrašo ↔ sąskaitų suderinimas (apmokėta/laukia) — *laukia išrašo*
- [ ] Mėnesio ataskaita mėnesio gale (`mb-lengvina-ataskaita`)

### Sistema
- [x] CLAUDE.md + DASHBOARD + projektų failai + `/dashboard` — 06-11
- [x] Priminimas kalendoriuje (06-12 09:00)
- [ ] Po Drive sutvarkymo: ištrinti dublikatus (2× KATALOGAS, 3× Layout PDF)
- [ ] (siūlymas) Sulieti šią šaką į pagrindinę, kad DASHBOARD matytųsi atsidarius repo be šakos rinkimo

## ⚙️ Automatika (kas sukasi be tavęs)

| Kas | Kur | Būsena |
|---|---|---|
| MB sąskaitų sync iš Gmail (kas val., 6 paskyros) | Routine + Drive `mb-lengvina-inbox-hourly-sync` | ✅ veikia (patikrinta 06-11) |
| MB kasdienė peržiūra + ataskaita | Drive `mb-lengvina-daily-review` | 🟡 sukurta, laukia Routine įjungimo |
| MB mėnesio ataskaita | Drive `mb-lengvina-ataskaita` | sukurta 06-11 |
| DBM: order→locker→shipment webhook | Apps Script (`apps_script/`) | ⏳ kodas paruoštas, neįdiegta |

## 💳 Usage (Claude limitai)

Iš sesijos vidaus nematoma. Žiūrėti: **claude.ai → Settings → Usage** arba terminale `/usage`.
