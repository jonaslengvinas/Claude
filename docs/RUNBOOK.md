# Runbook — from Omniva API keys to a smooth Parcely cutover

A practical, low-risk sequence. The golden rule: **build and test the new flow in
parallel, switch only when proven, keep Parcely as a fallback until then.**

## What you'll have tomorrow

From Omniva you need three things (ask the Account Manager / support if unsure):
- **OMNIVA_USERNAME** — XML/API username
- **OMNIVA_PASSWORD** — XML/API password
- **OMNIVA_CUSTOMER_CODE** — partner/customer code
- (optional) **X-Integration-Agent-Id** — only if Omniva treats you as a platform

Ask explicitly: "Please provide my **OMX API** username, password and **customerCode**,
and confirm I have access to the **TEST environment** (test-omx.omniva.eu)."

## Step 0 — already done ✅
- Nearest-locker engine works (address → locker + ID).
- Omniva payload builder works in **dry-run** (no keys needed):
  ```bash
  python3 -c "from omnibox.omniva import *; import json; \
    o=Order('DBM-1','Vardas','a@b.lt','+37060000000','LT','08217','Vilnius'); \
    print(json.dumps(pick_and_build(o,'CC')['payload'],ensure_ascii=False,indent=2))"
  ```

## Step 1 — plug in the keys (5 min)
```bash
export OMNIVA_USERNAME=...        # from Omniva
export OMNIVA_PASSWORD=...
export OMNIVA_CUSTOMER_CODE=...
export OMNIVA_ENV=test            # IMPORTANT: start on TEST, not live
```
Never commit these. In production put them in your server's secret store / env.

## Step 2 — test against Omniva TEST environment (½ day)
Register one real test shipment and pull the label, end-to-end:
```python
from omnibox.omniva import Order, OmnivaConfig, pick_and_build, register_shipment, request_label
cfg = OmnivaConfig.from_env()                 # env=test
order = Order("DBM-TEST-1","Vardas Pavardė","you@yourshop.lt","+37060000000","LT","08217","Vilnius")
built = pick_and_build(order, cfg.customer_code)
print(built["locker"]["name"], built["locker"]["id"])
resp = register_shipment(cfg, built["payload"])   # -> returns barcode (tracking no.)
barcode = resp["savedShipments"][0]["barcode"]    # confirm field name from response
label = request_label(cfg, [barcode], to_email="you@yourshop.lt")  # PDF to your email
```
Verify: (a) the locker is correct, (b) you get a barcode, (c) the label PDF arrives
and shows the right locker. Try LT, LV and EE addresses, and a bad-postcode/city case.

## Step 3 — reconfigure Shopify shipping (the part you asked about)
You do NOT need a locker selector in checkout. Simplify instead:

1. **Shopify admin → Settings → Shipping and delivery.**
2. In your shipping profile, for LT/LV/EE create **one flat rate** named e.g.
   *"Omniva paštomatas"* (your locker price). Remove courier/other options if you
   only want locker delivery — fewer choices = faster checkout.
3. Keep the rate **price-based or unconditional** (Parcely's docs note weight-based
   rates can't be mapped — same applies if you later map carriers).
4. Turn on **"Buy it now" / accelerated checkout** (Apple Pay / Google Pay / Shop Pay)
   on product pages — Settings → Checkout / theme settings. These pass the shipping
   address into the order, which is all our system needs.
5. That's it: the customer just pays; **no locker step, no courier step.**

## Step 4 — wire the order webhook (1–2 days dev)
1. Subscribe to the **`orders/create`** webhook (Shopify admin or app).
2. On each order: read `shipping_address` (name, address1, city, zip, country_code),
   `email`, `phone` → build an `Order` → `pick_and_build` → `register_shipment` →
   `request_label`.
3. Store in your DB table: order id ↔ customer ↔ chosen locker (id+name) ↔ barcode ↔
   label. This table is also what the "change locker" flow updates later.
4. Email the customer the tracking number + assigned locker (Omniva can also send the
   notification via `notifications`).
5. **Flag, don't guess:** if `pick_and_build` raises (address can't be geocoded),
   route the order to a manual queue instead of shipping it somewhere wrong.

## Step 5 — run in PARALLEL with Parcely (1–2 weeks)
- Keep Parcely installed and paid. Process a handful of **real** orders through the
  new pipeline (on `OMNIVA_ENV=live` now), while Parcely is still your safety net.
- Reconcile daily: did every order get a correct locker, barcode, label, email?
- Watch edge cases: missing phone (use email notify), PayPal/wallet address quirks,
  islands/border postal codes.

## Step 6 — cutover & drop Parcely
Once a couple of weeks of real orders are clean:
1. Switch label printing fully to your pipeline.
2. Cancel/uninstall **Parcely** (this is when you stop paying it).
3. Keep a documented rollback: re-enabling Parcely should take minutes if needed.

## Smooth-transition checklist
- [ ] Omniva keys work on TEST (barcode + label returned)
- [ ] LT, LV, EE addresses all resolve to a correct locker
- [ ] Bad-postcode order falls back to city (not a wrong region)
- [ ] Un-geocodable order is flagged, not mis-shipped
- [ ] Single "Omniva paštomatas" shipping rate live; courier step removed
- [ ] Apple/Google/Shop Pay enabled; address arrives in order
- [ ] `orders/create` webhook registers shipment + emails tracking
- [ ] DB row links order ↔ locker ↔ barcode (ready for change-locker flow)
- [ ] 1–2 weeks of real orders reconciled against Parcely
- [ ] Rollback path documented before cancelling Parcely

## Notes / gotchas
- **Confirm response field names** (`savedShipments[].barcode`, label `filedata`)
  against the live API response the first time — the manual is the spec, the response
  is the truth.
- **Refresh locker data** on a schedule (`python -m omnibox.fetch_data`, live Omniva
  URL) so new lockers are included — Omniva adds them regularly.
- **Returns** (section 1.5 of the manual) and the **change-locker** flow (section 1.6)
  are the next build after the happy path is stable.
