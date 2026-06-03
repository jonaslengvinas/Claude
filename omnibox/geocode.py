"""Turn a customer address into coordinates, no paid API required.

Strategy (postal-code based):
  1. Look up the postal code directly (most accurate, ~town/district level).
  2. If the exact code is unknown, try the closest numeric postal code in the
     same country (handles minor typos / unlisted codes).
  3. Fall back to matching the city/place name.

For production with full street-level accuracy you can swap ``geocode`` for a
call to Google/HERE Geocoding API while keeping the rest of the pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass

from .data import COUNTRIES, fold_place, load_city_index, load_postal
from .fetch_data import normalize_postal


@dataclass
class GeoResult:
    lat: float
    lon: float
    method: str  # how we resolved it: postal | postal_nearest | city
    matched: str  # what we actually matched on


def geocode(country: str, postal_code: str | None = None, city: str | None = None) -> GeoResult | None:
    country = (country or "").strip().upper()
    if country not in COUNTRIES:
        raise ValueError(f"unsupported country {country!r}; expected one of {COUNTRIES}")

    code = normalize_postal(postal_code or "")

    # 1. Exact postal code — most precise and reliable.
    if code:
        table = load_postal(country)
        if code in table:
            lat, lon = table[code]
            return GeoResult(lat, lon, "postal", code)

    # 2. City / place name — reliable when the postal code is missing or invalid.
    #    Preferred over a numeric-nearest postal guess, which can land on the
    #    wrong side of the country (postal numbering is not strictly geographic).
    if city:
        idx = load_city_index(country)
        key = fold_place(city)
        if key in idx:
            lat, lon = idx[key]
            return GeoResult(lat, lon, "city", city.strip())

    # 3. Last resort: closest numeric postal code (tolerates minor typos only).
    if code:
        nearest = _nearest_postal(load_postal(country), code)
        if nearest is not None:
            lat, lon = load_postal(country)[nearest]
            return GeoResult(lat, lon, "postal_nearest", nearest)

    return None


def _nearest_postal(table: dict[str, tuple[float, float]], code: str) -> str | None:
    """Closest postal code by numeric distance (same length, prefix-aware)."""
    try:
        target = int(code)
    except ValueError:
        return None
    best = None
    best_d = None
    for k in table:
        if len(k) != len(code):
            continue
        try:
            d = abs(int(k) - target)
        except ValueError:
            continue
        if best_d is None or d < best_d:
            best, best_d = k, d
    return best
