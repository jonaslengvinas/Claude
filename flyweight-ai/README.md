# Flyweight AI asistento automatizavimas — DesignedByMe.lt

> **Atskiras projektas.** Šis aplankas NESUSIJĘS su Omniva paštomatų / siuntų
> automatizacija (`apps_script/`, `omnibox/`). Čia tik AI asistento (Flyweight)
> dydžių konsultacijos logika ir promptai.

## Tikslas
Flyweight pokalbio botas padeda klientui pasirinkti teisingą dydį pagal ūgį, svorį,
kūno formą ir prekės cm matmenis. Vėliau — rekomendaciją perduoti komandai peržiūrai.

## Etapai (iš strategijos)
1. **Flyweight pagrindinis dydžių promptas** ← dabar dirbam tik su šituo.
2. Custom Route „Size consultation / size change".
3. Order management (saugus kelias per peržiūrą, ne automatinis keitimas).
4. Perdavimas į gamybos lentelę (atskira nuo Omniva lentelės).

## Failai
- `PROMPTAS.md` — pagrindinis Flyweight dydžių promptas (kuriame / tobuliname čia).
