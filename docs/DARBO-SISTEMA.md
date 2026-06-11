# Darbo sistema: kaip valdyti visus projektus iš vienos vietos

Atsakymai į pagrindinius skausmus: pamestas kontekstas tarp chatų, nežinia kiek darbų,
vienas langas vietoj kelių, extension'o ribotumai.

## 1. Vienas „smegenų centras" — šis repo

Kiekviena Claude Code sesija automatiškai perskaito `CLAUDE.md`, todėl **naujas chatas iškart žino
visus tris projektus (MG, MB, DBM)** ir privalo prieš baigdamas atnaujinti `DASHBOARD.md`.
Tai pakeičia „chatas neprisimena, kas kalbėta kitur": viskas, kas svarbu, gyvena failuose, ne pokalbiuose.

Praktinė taisyklė tau: **svarbų sprendimą ar faktą pasakei chate → paprašyk „įrašyk į dashboard/projekto failą"**.

## 2. Valdymo pultas — `DASHBOARD.md`

- Atsidaai GitHub'e (telefone irgi veikia): `jonaslengvinas/claude` → `DASHBOARD.md`.
- Ten matai: projektų būsenas, **kur stovi darbai dėl tavo sprendimo**, backlog'ą su laiko įverčiais, automatikos sąrašą.
- Atnaujinimas: bet kurioje Claude Code sesijoje parašyk `/dashboard` — sesija perskenuos repo, Drive ir Shopify ir perrašys būsenas.

## 3. Keli agentai vienu metu (vietoj vieno lango)

Claude Code web (claude.ai/code) leidžia **kelias lygiagrečias sesijas tame pačiame repo** — kiekviena gauna
savo šaką ir savo konteinerį:

- Sesija A: „DBM: prijunk Omniva TEST raktus pagal RUNBOOK"
- Sesija B: „MG: įgyvendink audito R-1 ir R-6"
- Sesija C: „MB: patikrink ar inbox sync veikia"

Visos jos skaito tą patį `CLAUDE.md`, tad konteksto kartoti nereikia. Be to, vienos sesijos viduje Claude gali
paleisti kelis subagentus lygiagrečiai (pvz. `omniva-integracija` ir `shopify-pagalbininkas` vienu metu).
Patarimas: vienai sesijai — vienas projektas, kad šakos nesikirstų.

## 4. Usage (kiek limito liko)

Iš sesijos vidaus nematoma. Žiūrėk **claude.ai → Settings → Usage** arba terminale `/usage`.
Taupymui: vietoj daug trumpų chatų su kartojamu kontekstu — viena Claude Code sesija projektui;
sunkius tyrimus leisti kaip background darbus, ne dialogu po sakinį.

## 5. Chrome extension'as: kas normalu ir ką daryti

- **Neprisimena, iš kurio chato kalbėta** — taip suprojektuota: extension'o pokalbiai konteksto nesidalina.
  Sprendimas — šis repo: svarbi informacija turi atsidurti failuose, tada bet kuris chatas ją ras.
- **Perima viso kompiuterio valdymą** — extension'as valdo naršyklės tab'ą; jei trukdo, duok jam atskirą
  Chrome profilį/langą, o ilgus darbus leisk per Claude Code web (jis dirba debesyje ir tavo kompiuterio neliečia).
- **Negali sukurti reklamos per extension'ą** — reklamos platformos (Meta/Google Ads) blokuoja automatizuotas naršykles.
  Patikimesnis kelias: reklamos kūrimas per API/MCP (šioje aplinkoje prijungtas Supermetrics su `campaign_create`;
  kreatyvai — per Adobe MCP), o extension'ą naudoti tik peržiūrai.
- **Kartais neprisijungia** — atsijungti/prisijungti extension'e, patikrinti ar Chrome ir extension atsinaujinę;
  jei kartojasi, tai claude.ai sesijos pasibaigimas, ne tavo klaida.

## 6. Drive tvarka

Struktūra (po `tools/drive_tvarkymas.gs` paleidimo):

```
My Drive/
├── MG Drive/            (Setlistai, Sutartys, Marketingas, Maketai, Renginiai, Audio)
├── MB Lengvina/         (2026-05, 2026-06, ... — viduje Pirkimai/Pardavimai/Bankas)
├── _INBOX_naujos_saskaitos/   (čia krenta naujos sąskaitos)
├── Asmeninės sąskaitos 2026/
└── _Claude dokumentai/  (auditai, instrukcijos, Claude'o raportai)
```

Taisyklė: šaknyje failų nelaikom. Naujas failas → iškart į projekto aplanką.
