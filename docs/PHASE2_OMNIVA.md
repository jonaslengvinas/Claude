# Phase 2 notes — connecting the locker to Omniva / Parcely.app

This captures the key facts from the Omniva **OMX API** manual and the Parcely.app
setup, so phase 2 (assign locker → label → tracking → email) is ready to build.

## The key link: locker `id` == Omniva `offloadPostcode`

Our `find_nearest()` returns each locker's `id` (Omniva's own locker postcode,
e.g. `88827`). In the Omniva OMX API this is exactly:

```
shipments/receiverAddressee/address/offloadPostcode
```

> "Post office / parcel machine / pickup point postcode for describing the delivery
> office – customer will get it from this location. **Mandatory** when mainService
> is PARCEL and deliveryChannel is PARCEL_MACHINE."

So the locker `id` we already produce in phase 1 is the precise value Omniva (and
Parcely) needs to route a parcel to that locker. Nothing else to compute.

## Omniva OMX API essentials

- Auth: HTTP **Basic Auth**, username + password issued by the Omniva Account
  Manager (the same creds Parcely's "Automated data exchange" asks for).
- Extra header on every request: `X-Integration-Agent-Id: Developer_XXXXXX_YYYYYY`.
- Register shipment (B2C):
  - TEST: `https://test-omx.omniva.eu/api/v01/omx/shipments/business-to-client`
  - LIVE: `https://omx.omniva.eu/api/v01/omx/shipments/business-to-client`
- Minimum shipment fields: `customerCode`, `mainService=PARCEL`,
  `deliveryChannel=PARCEL_MACHINE`, `receiverAddressee` (name, contactMobile,
  contactEmail, `address.country`, `address.offloadPostcode = <locker id>`),
  `senderAddressee`.
- Response returns a **barcode** (the tracking number).
- Separate calls: request label PDF (1.7), request events/tracking (1.10),
  change shipment (1.6) — this powers the "customer wants a different locker"
  flow (re-assign → regenerate label/barcode → email → update our DB row).

## Two possible routes for phase 2

The user currently makes labels with **Parcely.app**, which itself connects to
Omniva. So the chosen locker can reach Omniva in one of two ways:

1. **Via Parcely (preferred if it works):** write our chosen locker onto the
   Shopify order in the place Parcely reads the locker from (order attribute /
   metafield / shipping line) so Parcely generates the label automatically.
   *TODO: confirm exactly what field Parcely expects for the selected locker on a
   basic Shopify plan with no in-checkout selector.*
2. **Direct Omniva OMX API:** our backend calls the B2C endpoint with
   `offloadPostcode = locker id`, gets barcode + label, emails the customer.
   Fully under our control; needs the Omniva API username/password/customerCode.

## What the user still needs from Omniva

- Omniva **API username + password** (XML/API) — for Parcely's "Automated data
  exchange" and/or our direct integration.
- **customerCode** (partner code).
- (If integrating as a platform) an `X-Integration-Agent-Id` value.

Parcely.app LT mapping is already set to **"Omniva LT Paštomatas"**; the missing
piece is the API credentials, which Omniva support provides once the contract is
active.
```
```
