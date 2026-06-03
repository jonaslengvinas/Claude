# Omnibox — nearest Omniva parcel machine finder

Suggest the **closest Omniva parcel machine (paštomatas / pakomāts / pakiautomaat)**
for a customer in **Lithuania, Latvia or Estonia**, based on the address they enter
at Shopify checkout. The goal: the customer never has to pick a locker manually, so
checkout stays frictionless and converts better — you assign / ship to the nearest
locker afterwards.

## How it works

```
customer address (country + postal code)
        │
        ▼
  geocode  (postal code → lat/lon, GeoNames data, no paid API)
        │
        ▼
  rank lockers by great-circle (haversine) distance, same country only
        │
        ▼
  nearest locker  (+ 2–3 alternatives)
```

Two datasets are cached locally (see `data/`):

| dataset | source | used for |
|---|---|---|
| Omniva parcel machines (name + coordinates) | Omniva `locations.json` (live) / mijora GitHub mirror | the lockers we rank |
| Postal code → lat/lon for LT/LV/EE | GeoNames (via `symerio/postal-codes-data`) | geocoding the customer |

Postal-code geocoding resolves to roughly town/district level — more than precise
enough to pick the right locker, since lockers sit kilometres apart and the dataset
is free, offline and needs no API key.

## Quick start

```bash
# 1. (re)build the cached datasets
python -m omnibox.fetch_data

# 2a. test from the command line
python cli.py LT 08217 Vilnius
python cli.py --demo            # batch of example addresses across LT/LV/EE

# 2b. or a tiny web UI: open http://127.0.0.1:5000
python app.py
```

### Example

```
$ python cli.py LT 08217 Vilnius
LT  postal=08217  city=Vilnius
  geocoded via postal (08217) -> 54.7076, 25.2745
  ->   0.34 km  Vilniaus VC ŽALGIRIO 135 paštomatas  [Žalgirio g. 135, Vilnius]
       1.09 km  Vilniaus MAXIMA Tuskulėnų paštomatas  [Tuskulėnų g. 66, Vilnius]
       1.32 km  Vilniaus VIADA Saltoniškių paštomatas [Saltoniškių g. 12, Vilnius]
```

## JSON API

`app.py` exposes the exact shape a Shopify order webhook would call:

```
GET /api/nearest?country=LT&postal=08217&city=Vilnius&limit=4
```

```json
{
  "geocode": { "method": "postal", "matched": "08217", "lat": 54.7076, "lon": 25.2745 },
  "lockers": [
    { "id": "...", "name": "Vilniaus VC ŽALGIRIO 135 paštomatas",
      "country": "LT", "city": "Vilnius", "address": "Žalgirio g. 135, Vilnius",
      "lat": 54.71, "lon": 25.27, "distance_km": 0.34 }
  ]
}
```

Use it programmatically:

```python
from omnibox import find_nearest
res = find_nearest("LT", postal_code="08217", city="Vilnius", limit=4)
best = res.matches[0].locker        # nearest locker dict
print(best["name"], res.matches[0].distance_km)
```

## Where this fits with Shopify

On a basic Shopify plan you cannot add a locker selector inside checkout, so:

1. Customer checks out normally with their **home address** (no extra step → best conversion).
2. Your backend receives the order (Shopify `orders/create` webhook), calls
   `find_nearest(...)`, and gets the closest locker.
3. **Phase 2:** push that locker as the shipping destination to the **Omniva API**,
   get a shipping label + tracking number, and email it to the customer.

This repo implements **phase 1** (find the locker). Phase 2 (Omniva API: register
shipment, label, tracking) plugs in on top of `find_nearest` and is documented as a
TODO in `omnibox/`.

## Data freshness

The committed `data/lockers.json` is a snapshot. Omniva adds lockers regularly, so in
production run `python -m omnibox.fetch_data` on a schedule (it pulls the live
`omniva.lt/locations.json`). The GitHub mirror is only a fallback for restricted
networks.

## Tests

```bash
python tests/test_lockers.py
```
