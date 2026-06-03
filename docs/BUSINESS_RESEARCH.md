# Auto-locker Shopify app for the Baltics — market & revenue research

Research date: 2026-06-03. Scope chosen: Shopify app for the Baltics (Omniva /
Venipak / LP Express / DPD), focus on competitor earnings benchmarks. All figures
have sources; many e-commerce trackers and the App Store blocked automated fetching,
so install/review counts are point-in-time estimates read from search snippets —
re-verify on the live pages before using in a pitch deck.

## TL;DR — can you make money?

Yes, realistically — but it is a *modest, winnable niche*, not a goldmine, and you
have one real competitor on your exact idea.

- The Baltic market is one of the most locker-centric on earth (Estonia ~84% of
  shoppers prefer lockers), so a locker app is **table stakes, not a nice-to-have**.
- The category leader **Parcely.app has ~884 Shopify installs** at **$3.95+/mo** —
  proof merchants pay, and a realistic ceiling for a strong app here.
- ~72% of all Shopify apps earn **under $1k/mo**; Shopify takes **0%** until $1M
  lifetime. So the constraint is demand/marketing, not Shopify's cut.
- **Realistic solo-founder path: ~€0.5–3k MRR in year 1, €3–10k MRR by year 2–3**
  if execution is good. The closest real precedent is a Lithuanian solo founder
  (Erikas Mališauskas) who hit $1k MRR in 4 months and later sold an app for $250k.
- ⚠️ **Swotzy (Latvia) already does automatic nearest-locker for Omniva+Venipak on
  Shopify.** Your "auto" differentiator beats every App Store incumbent but NOT them.

## 1. Market size (SOM)

| Metric | Figure | Source |
|---|---|---|
| Shopify stores in the Baltics | ~6,000–12,000 (rough; trackers disagree ~2x) | Store Leads / SellerCenter |
| Baltic e-commerce revenue | ~$2.7B (2023) | Statista |
| Estonia locker preference | ~84% of e-shoppers | Omniva survey |
| Lithuania locker preference | ~55% (≈60% of parcels via lockers) | Omniva |
| Latvia locker preference | ~53% | Omniva |
| Omniva parcel machines (Baltics) | ~1,321 (~172k compartments) | Omniva 2024 PR |
| DPD lockers (Baltics) | ~1,100 (EE 340 / LV 345 / LT 400) | DPD/Geopost 2024 |
| Venipak lockers | ~600 owned (LT 251 / LV 201 / EE 151) | Venipak 2025 |
| LP Express / Unisend lockers | >700 across Baltics | Unisend 2024–25 |

Serviceable obtainable market: realistically a few thousand Baltic Shopify stores
that ship with lockers. Small in absolute terms — but high willingness to pay and
locker delivery is the default, not an upsell.

## 2. Competitors & what they earn

| App | Installs | Reviews | Rating | Entry price | Locker pick |
|---|---|---|---|---|---|
| **Parcely.app** (direct leader) | **~884** | 50 | 4.4★ | **$3.95/mo** | Manual (map) |
| **Swotzy** (platform) | unknown | — | — | unknown | **AUTOMATIC nearest** ⚠️ |
| ShipWisely | unknown | — | — | $11/mo | Auto-display nearest |
| Globe (AppFleece) | unknown | 106 | 5.0★ | tier by plan | Manual |
| Atlas Pickup Points | unknown | 70 | 4.8★ | $29/mo | Manual |
| Octolize Pickup Points PRO | unknown | 44 | 5.0★ | free + paid | Manual |
| Lietuvos Paštas (official) | unknown | 87 | 4.78★ | Free | Manual |
| Omniva shipping (Mijora) | unknown | 8 | 1.0★ | Free | Manual |
| Venipak Shipping (ShopUp) | unknown | 0 | — | Free install | Manual |

**Parcely revenue estimate (illustrative):** ~884 installs × blended ARPU ~$5–9/mo
(tiered by number of shipping methods) ≈ **~$4–8k MRR (~$50–95k/yr) gross**. Not
audited — an order-of-magnitude read of the category leader.

**Key strategic facts:**
- Your auto-selection idea **beats every App Store incumbent** (all manual).
- **Swotzy is the one true competitor** on the differentiator — study their UX,
  pricing, and weaknesses; differentiate on post-purchase model, support, price,
  carrier coverage, or platforms beyond Shopify.
- The official carrier apps are **free but low quality** (Omniva's own app: 1.0★) —
  a real quality/UX opening.

## 3. The conversion argument (your sales pitch to merchants)

| Lever | Effect | Source |
|---|---|---|
| Better checkout design | up to **+35% conversion** | Baymard |
| Address autofill (guest) | **+45% checkout conversion rate** | Google/Shopify 2024 |
| "Too long/complicated checkout" | **18%** abandon for this reason | Baymard |
| Avg cart abandonment | **70.2%** | Baymard |
| Baltic locker preference | **53–84%** | Omniva |

No public study isolates "nearest-locker pre-selection = +X%", but the defensible
claim is the inference: removing the locker-search step is the locker equivalent of
address autofill (+45%) in a market where 53–84% want a locker anyway.

## 4. Realistic revenue projection (solo founder)

Assumptions: price ~€9–15/mo (or freemium + per-label usage), Baltic-only niche,
Parcely's ~884 installs as the realistic strong-case ceiling.

| Scenario | Paying merchants | ARPU/mo | MRR | ARR | Timeline |
|---|---|---|---|---|---|
| **Conservative** | 40–60 | €10 | **€0.4–0.6k** | €5–7k | year 1 |
| **Base** | 150–250 | €12 | **€1.8–3k** | €22–36k | year 1–2 |
| **Optimistic** | 500–800 | €12–15 | **€6–12k** | €72–144k | year 2–3 |

Reality checks: ~72% of Shopify apps make <$1k/mo; App Store listing→paid conversion
averages ~1.5% (median <1%), so **listing traffic + reviews are the bottleneck**.
Add one-time setup fees and custom integrations (WooCommerce/PrestaShop, non-Shopify
merchants) as extra non-recurring revenue — the same engine already works there.

## 5. Roadmap: idea → automation → revenue

**Phase 0 — DONE:** working nearest-locker engine (this repo). Address → nearest
Omniva locker + ID. Core tech de-risked.

**Phase 1 (2–4 wk) — internal tool / paid service:** wire to your own Shopify
`orders/create` webhook; auto-assign locker; push to Parcely/Omniva for the label;
email customer. Sell it as a done-for-you service to 3–5 Baltic merchants first
(fastest cash, validates willingness to pay, generates testimonials).

**Phase 2 (1–2 mo) — productize:** add Venipak / LP Express / DPD locker datasets
(same haversine logic); a merchant dashboard; the locker-change flow (alternatives
email / change by name → regenerate label + tracking → update DB → notify).

**Phase 3 (1–2 mo) — Shopify App Store:** embedded app, **Shopify App Pricing**
billing, **GDPR webhooks**, Theme App Extension, Polaris UI. Review takes ~5–10
business days (2–4 wk with fixes). Launch **freemium / €9–15 tiers + 14-day trial**.

**Phase 4 — growth:** App Store SEO (keyword-rich 30-char name + 62-char subtitle),
accumulate reviews fast, targeted cold outreach (<100 words, 3–5 follow-ups) to
Baltic merchants already shipping with lockers, carrier/agency partnerships. Chase
**Built for Shopify** at 50 paid installs + 5 reviews for promotion.

## 6. Recommendation

1. **Don't lead with "we auto-pick the locker" alone** — Swotzy says that too. Lead
   with **"zero checkout friction → higher conversion"** for *basic-plan* merchants
   who literally cannot add a locker picker in checkout (your exact situation). That
   post-purchase, no-checkout-change angle is a sharp, underserved wedge.
2. **Start as a paid service on your own + a few stores** before building the public
   app — cash and proof first, code second.
3. **Price like the niche:** freemium or €9–15/mo + optional per-label usage.
4. **Win on quality/support** — the incumbent carrier apps are free but bad (1.0★).
5. **Expand beyond Shopify** (WooCommerce/PrestaShop, custom) for integration fees;
   the engine is platform-agnostic.

## Sources (selected)
- Baymard cart abandonment & checkout UX — https://baymard.com/lists/cart-abandonment-rate
- Google/Shopify autofill +45% — https://blog.google/products-and-platforms/products/chrome/chrome-autofill/
- Omniva 2024 network — https://www.omnivagroup.com/news/omniva-invests-e3-6-million-and-adds-135-new-parcel-machines-to-its-network/
- Estonia 84% lockers — https://last-mile-delivery.retailtechinsights.com/cxoinsight/decade-of-developing-parcel-lockers-estonian-omniva-experience-nwid-1155.html
- Parcely pricing/installs — https://www.parcely.app/pricing/ , https://shopify-spy.com/apps/parcelyapp/
- Swotzy auto nearest-locker — https://help.swotzy.com/hc/en-lv/articles/15422701113756
- Shopify revenue share (0% to $1M) — https://shopify.dev/docs/apps/launch/distribution/revenue-share
- 72% of apps <$1k MRR — https://www.indiehackers.com/post/shopify-apps-by-revenue-mrr-95d499c311
- Lithuanian solo founder case ($1k MRR in 4 mo) — https://malisauskas.medium.com/from-zero-to-1000-mrr-in-4-months-how-i-created-a-shopify-app-microsaas-b84cf72e24f5
- Built for Shopify requirements — https://shopify.dev/docs/apps/launch/built-for-shopify/requirements
