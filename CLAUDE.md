# Jono darbo centras — kontekstas kiekvienai Claude sesijai

Šis repo yra **vienintelis bendras „smegenų centras"** visiems Jono Claude pokalbiams.
Kiekviena sesija jį mato, todėl viskas, ką verta prisiminti tarp pokalbių, rašoma ČIA, ne pokalbyje.

## Privalomos taisyklės kiekvienai sesijai

1. **Sesijos pradžioje** perskaityk `DASHBOARD.md` — ten dabartinė visų darbų būsena.
2. **Prieš baigdamas darbą** atnaujink `DASHBOARD.md`: ką padarei, kas liko, ką naujo sužinojai.
3. Jei reikia Jono sprendimo — įrašyk jį į `DASHBOARD.md` skiltį **„Laukia TAVO sprendimo"** (su kontekstu ir pasirinkimais), nepalik vien pokalbyje.
4. Projekto žinias rašyk į atitinkamą `projektai/*.md` failą.
5. Atsakinėk lietuviškai, nebent Jonas paprašo kitaip.
6. Commit'ai daromi į tau priskirtą `claude/...` šaką ir push'inami prieš baigiant sesiją (kitaip darbas dingsta).

## Trys Jono projektai (žymėjimas)

| Kodas | Kas tai | Pagrindinės vietos |
|---|---|---|
| **MG** | Midnight Gents — gyvos muzikos grupė (13 muzikinių projektų, renginiai, svetainė) | Drive: „MG Drive" (`1g2RkSlsBNtlwYyL7jfHPKAIiwwKcDSjC`), skaičiuoklė „MG VISKAS 2026" (`1TT_0y5vGnnFG7Igp6f7241SQiwiMAaZaPE2xBJF27cs`), svetainė Netlify | 
| **MB** | MB Lengvina — Jono įmonė, buhalterija (sąskaitos, pirkimai/pardavimai, bankas) | Drive: „MB Lengvina" (`1-G9xcgvnJ8wyqNL80OnSXiWedpz0SGRc`), inbox: „_INBOX_naujos_saskaitos" (`1S-C2VVyV6Nue8IRP3fb0k-RgE8M8TCzi`) |
| **DBM** | „Designed by me" — marškinėlių Shopify parduotuvė + Omniva siuntimo automatika (šis repo, `apps_script/` + `omnibox/`) | Shopify MCP, skaičiuoklė „Designed by me 2026" (`1BzlWnik8DUp4NF_JCRvGACRprUsOd6P3unOKna0p7ow`), DBM sąskaitų aplankas Drive (`1J_D_TfO0I7VOCFAHPTV_AMI9bwSqnr5L`) |

Detalės: `projektai/MG.md`, `projektai/MB.md`, `projektai/DBM.md`.

## Kas šiame repo

- `apps_script/` — **veikiantis DBM produktas v1**: Shopify → artimiausias Omniva paštomatas → siunta → tracking (diegimas: `apps_script/DIEGIMAS.md`).
- `omnibox/`, `app.py`, `cli.py` — Python prototipas / duomenų įrankiai tai pačiai logikai.
- `docs/` — PHASE2_OMNIVA (API faktai), RUNBOOK (raktų prijungimas), BUSINESS_RESEARCH (Shopify app rinkos tyrimas), DARBO-SISTEMA (kaip Jonas dirba su Claude).
- `projektai/` — projektų atmintis tarp sesijų.
- `tools/drive_tvarkymas.gs` — vienkartinis Google Drive tvarkymo skriptas.
- `.claude/agents/` — subagentai: `omniva-integracija`, `shopify-pagalbininkas`, `kodo-aiskintojas`.
- `.claude/commands/dashboard.md` — `/dashboard` komanda dashboard'ui atnaujinti.

## Prieinami įrankiai (MCP)

Google Drive (skaityti/kurti; perkėlimui naudoti Apps Script), Gmail, Google Calendar,
Shopify (užsakymai, produktai, analitika), Supermetrics (reklamos/analitika), Adobe (grafika), GitHub.

## Drive tvarka (laikytis!)

- Nieko nepalikti „My Drive" šaknyje — viskas į `MG Drive/`, `MB Lengvina/` arba DBM aplankus.
- MB sąskaitos: naujos krenta į `_INBOX_naujos_saskaitos`, po apdorojimo — į `MB Lengvina/<YYYY-MM>/...`.
- Claude'o sukurti dokumentai (instrukcijos, auditai) — į aplanką `_Claude dokumentai`.
