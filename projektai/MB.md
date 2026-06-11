# MB — MB Lengvina (įmonės buhalterija)

Jono įmonės dokumentų tvarkymas: gaunamos/išrašomos sąskaitos, banko transakcijos, mėnesinės ataskaitos.

## Vietos (Drive)

- **Šakninis aplankas:** „MB Lengvina" — `1-G9xcgvnJ8wyqNL80OnSXiWedpz0SGRc`
  - Mėnesių aplankai: „MB Lengvina 2026-05" (`1y-OwM2jce0aumbAk58G765-6aS4K364a`), „MB Lengvina 2026-06" (`1bUw5nbPgfb-BmU7arIhhR4dCVHPZVhel`)
  - Mėnesio viduje: `Pirkimai <YYYY-MM>/`, `Pardavimai <YYYY-MM>/`, `Banko transakcijos <YYYY-MM>/`
- **Naujų sąskaitų inbox:** „_INBOX_naujos_saskaitos" — `1S-C2VVyV6Nue8IRP3fb0k-RgE8M8TCzi`
- **Asmeninės sąskaitos:** „Asmeninės sąskaitos 2026" — `1J9rJaOmLWkxumBMy-cA1VbekJQn6-we7`
- **Automatika:** „mb-lengvina-inbox-hourly-sync" (`1VB2Ox8r1tDJB9ti_wKEz1yY8vhaW7oC3`, su SKILL.md), „mb-lengvina-ataskaita" (`1ITF8SE5YAdV9leTx4FBs8eA22AFZqhrr`, index.html ataskaita)

## Procesas

1. Nauja sąskaita (iš Gmail ar rankiniu būdu) → `_INBOX_naujos_saskaitos`.
2. Valandinis sync turėtų išrūšiuoti į `MB Lengvina/<YYYY-MM>/Pirkimai|Pardavimai/`.
3. Mėnesio gale — ataskaita per „mb-lengvina-ataskaita".

## Atvira

- Patvirtinti, kad valandinis sync realiai veikia (sukurtas 2026-06-11, nepatikrintas).
- DBM sąskaitos (DBM####.pdf) krenta į atskirą aplanką `1J_D_TfO0I7VOCFAHPTV_AMI9bwSqnr5L` — nuspręsti, ar jos turi būti įtrauktos į MB pardavimų flow.

## Užrašai sesijoms

*(pildyti naujausius viršuje)*
