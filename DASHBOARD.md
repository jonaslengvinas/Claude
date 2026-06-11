# 📊 DASHBOARD — visų darbų būsena

> Atnaujinta: **2026-06-11** (sistemos sutvarkymo sesija).
> Atnaujinti: bet kuriame Claude Code pokalbyje parašyk `/dashboard`.

## Bendras vaizdas

| Projektas | Būsena | Kitas žingsnis | Kieno eilė |
|---|---|---|---|
| **DBM / Omnibox** | 🟡 v1 paruošta, 2 fazė užblokuota | Gauti Omniva API raktus | **JONO** |
| **MG svetainė** | 🟡 veikia, auditas laukia sprendimų | Atsakyti į audito R-1…R-7 | **JONO** |
| **MB buhalterija** | 🟢 automatika sukurta 06-11 | Patikrinti, ar inbox sync veikia | Claude |
| **Drive tvarka** | 🟡 skriptas paruoštas | Paleisti `tools/drive_tvarkymas.gs` | **JONO** (5 min) |

## 🔴 Laukia TAVO sprendimo

Čia visi taškai, kur darbai stovi, kol nenuspręsi. Sprendimą gali parašyti bet kuriame chate — sesija atnaujins šį failą.

1. **Omniva API raktai** *(tavo laiko: 5 min; atblokuoja ~½ d. Claude darbo)*
   Parašyti Omniva vadybininkui: „Prašau OMX API username, password, customerCode ir TEST aplinkos (test-omx.omniva.eu) prieigą."
   Be šito DBM siuntos automatiškai nesiregistruoja. Detalės: `docs/RUNBOOK.md`.

2. **MG svetainės auditas — R-1…R-7** *(tavo laiko: 10–15 min; darbų ~8–14 val.)*
   2026-05-08 auditas pateikė 7 rekomendacijas (hero, projektų puslapis, forma, social proof, premium copy, mobile, GDPR) ir laukia tavo ✅/❌ prie kiekvienos.
   Dokumentas: Drive „STRATEGIC-AUDIT-2026-05-08.md" (`1SPMM-PrKoyX_SVEFz-BVRgszZ4z-qx57SKtug-H89y0`), skiltis „TAU SPRĘSTI".
   ⚠️ GDPR/cookie banerio nebuvimas — teisinė rizika, rekomenduoju bent R-7 patvirtinti.

3. **Parcely vs tiesioginis Omniva OMX** *(sprendimas, kai bus raktai)*
   Lipdukus toliau generuoti per Parcely (paprasčiau, bet reikia išsiaiškinti, iš kur Parcely skaito paštomatą) ar tiesiogiai per OMX API (pilna kontrolė). Faktai: `docs/PHASE2_OMNIVA.md`.

4. **Ar daryti viešą Shopify app'są?** *(strateginis, neskubus)*
   Tyrimas (`docs/BUSINESS_RESEARCH.md`): niša reali (~€0.5–3k MRR per 1 m.), bet Swotzy jau daro tą patį. Spręsti po to, kai DBM flow veiks sau.

5. **Drive tvarkymas — paleisti skriptą** *(tavo laiko: 5 min)*
   `tools/drive_tvarkymas.gs` perkelia ~25 palaidus failus iš Drive šaknies į projektų aplankus. Instrukcija failo viršuje. Prieš paleisdamas peržiūrėk planą — ypač ar „Dekoras" skaičiuoklės tikrai MG.

## 🗂 Neužbaigti darbai (backlog)

### DBM / Omnibox
- [ ] **(užblokuota #1)** OMX TEST integracija: siunta + lipdukas + tracking — *~½ d.*
- [ ] **(po #3)** Pilnas flow LIVE: order → locker → shipment → fulfill → email — *~1 d.*
- [ ] Lockerių datasetas atsinaujina pagal grafiką (dabar — rankinis snapshot) — *~1 val.*
- [ ] Patikrinti, ar Apps Script webhook'as gyvas (health check dashboarde) — *~15 min*

### MG
- [ ] **(po #2)** Įgyvendinti patvirtintas audito rekomendacijas — *~8–14 val. pagal pasirinkimą*
- [ ] Surinkti testimonials iš buvusių klientų (be jų R-4 nedaromas) — *Jono outreach, 1–2 sav.*
- [ ] Analytics Phase 1 (GA4 + Clarity + consent) — *~2 val., galima be sprendimų*

### MB Lengvina
- [ ] Patikrinti, ar `mb-lengvina-inbox-hourly-sync` realiai sukasi kas valandą — *~15 min*
- [ ] Birželio sąskaitų suvedimas į `MB Lengvina/2026-06/` — *automatika turėtų daryti; patikrinti*
- [ ] Mėnesio ataskaita („mb-lengvina-ataskaita") — pasikartojantis procesas mėnesio gale

### Sistema
- [x] Bendras kontekstas visiems chatams (`CLAUDE.md`) — 2026-06-11
- [x] Dashboard + `/dashboard` komanda — 2026-06-11
- [x] Drive tvarkymo skriptas — 2026-06-11
- [ ] Po Drive sutvarkymo: pašalinti dublikatus (2× KATALOGAS, 3× Layout PDF)

## ⚙️ Automatika (kas jau sukasi be tavęs)

| Kas | Kur | Būsena |
|---|---|---|
| DBM: order→locker→shipment webhook | Google Apps Script (žr. `apps_script/DIEGIMAS.md`) | patikrinti health check |
| MB sąskaitų inbox sync (kas val.) | Drive `mb-lengvina-inbox-hourly-sync` | sukurta 06-11, nepatvirtinta |
| MB ataskaita | Drive `mb-lengvina-ataskaita` | sukurta 06-11 |

## 💳 Usage (Claude limitai)

Iš sesijos vidaus usage nematomas. Žiūrėti: **claude.ai → Settings → Usage** (planas, savaitės limitai)
arba Claude Code terminale — komanda `/usage`. Patarimas: ilgus tyrimo/kodavimo darbus leisti per
Claude Code sesijas (jos efektyvesnės už daug atskirų chatų su kartojamu kontekstu).
