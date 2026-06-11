---
description: Atnaujinti DASHBOARD.md — perskenuoti repo, Drive, Shopify ir perrašyti būsenas
---

Atnaujink `DASHBOARD.md` pagal realią dabartinę būseną:

1. Perskaityk `DASHBOARD.md`, `projektai/MG.md`, `projektai/MB.md`, `projektai/DBM.md`.
2. Patikrink faktus, kiek leidžia įrankiai:
   - **Drive:** ar `_INBOX_naujos_saskaitos` tuščias? Ar atsirado naujų failų šaknyje (search `parentId = 'root'`)? Ar yra naujas `MB Lengvina/<einamasis mėnuo>` aplankas?
   - **Shopify:** kiek užsakymų per paskutines 7 d. (`list-orders`), ar yra unfulfilled.
   - **Repo:** `git log` — kas padaryta po paskutinio dashboard atnaujinimo.
3. Perrašyk `DASHBOARD.md`:
   - lentelę „Bendras vaizdas" (būsenos 🟢🟡🔴, kieno eilė),
   - „Laukia TAVO sprendimo" — pašalink išspręstus, pridėk naujus su laiko įverčiais,
   - backlog'ą — pažymėk padarytus `[x]`, pridėk naujus su įverčiais,
   - datą viršuje.
4. Užcommit'ink ir push'ink į savo `claude/...` šaką.
5. Atsakyme parašyk trumpą santrauką: kas pasikeitė, kur stovi darbai dėl Jono sprendimo.
