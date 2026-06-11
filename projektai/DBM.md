# DBM — „Designed by me" (marškinėlių parduotuvė)

Shopify parduotuvė + automatinis Omniva siuntimas (šio repo turinys). Užsakymų numeriai: `DBM####`.

## Vietos

- **Kodas:** šis repo — `apps_script/` (veikiantis v1), `omnibox/` (Python prototipas)
- **Shopify:** per Shopify MCP (užsakymai, produktai, analitika)
- **Skaičiuoklė:** „Designed by me 2026" — `1BzlWnik8DUp4NF_JCRvGACRprUsOd6P3unOKna0p7ow`
- **Sąskaitų PDF aplankas (DBM####.pdf):** `1J_D_TfO0I7VOCFAHPTV_AMI9bwSqnr5L`
- **Lipdukai šiandien:** Parcely.app (rankinis/pusiau automatinis)

## Architektūra (v1, Apps Script)

`orders/paid` webhook → artimiausias Omniva paštomatas (paštomato `id` == OMX `offloadPostcode`) → siuntos registracija → tracking atgal į Shopify (fulfilled) → Print Order Pro siunčia klientui sąskaitą su tracking. Diegimas: `apps_script/DIEGIMAS.md`. TEST/LIVE jungiklis, web dashboard, health check.

## Atvira (eiliškumas)

1. **Omniva OMX raktai** — be jų 2 fazė stovi (DASHBOARD #1; instrukcija `docs/RUNBOOK.md`).
2. TEST aplinkos integracija (siunta+lipdukas+tracking) — `docs/PHASE2_OMNIVA.md`.
3. Sprendimas Parcely vs tiesioginis OMX (DASHBOARD #3).
4. LIVE perjungimas, Parcely paliekant fallback'u.
5. (vėliau) Viešo Shopify app'so klausimas — `docs/BUSINESS_RESEARCH.md` (konkurentas: Swotzy).

## Užrašai sesijoms

*(pildyti naujausius viršuje)*
