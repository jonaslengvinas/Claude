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
from .geocoder_api import geocode_via_api


@dataclass
class GeoResult:
    lat: float
    lon: float
    method: str  # how we resolved it: api | postal | postal_prefix | city
    matched: str  # what we actually matched on


def geocode(
    country: str,
    postal_code: str | None = None,
    city: str | None = None,
    street: str | None = None,
) -> GeoResult | None:
    country = (country or "").strip().upper()
    if country not in COUNTRIES:
        raise ValueError(f"unsupported country {country!r}; expected one of {COUNTRIES}")

    # 0. Exact street-level via paid API — only if a key is configured (cached).
    api = geocode_via_api(country, street=street, postal=postal_code, city=city)
    if api is not None:
        return GeoResult(api[0], api[1], "api", street or postal_code or city or "")

    code = normalize_postal(postal_code or "")

    # 1. Exact postal code — most precise and reliable.
    if code:
        table = load_postal(country)
        if code in table:
            lat, lon = table[code]
            return GeoResult(lat, lon, "postal", code)

    # 2. Postal-code prefix — same district. Postal numbering IS hierarchical, so
    #    codes sharing the longest prefix sit in the same area. This beats a whole-
    #    city centroid when the exact code is missing from our (incomplete) data.
    if code:
        prefixed = _prefix_match(load_postal(country), code)
        if prefixed is not None:
            lat, lon, prefix = prefixed
            return GeoResult(lat, lon, "postal_prefix", prefix)

    # 3. City / place name — reliable fallback when we have no usable postal code.
    if city:
        idx = load_city_index(country)
        key = fold_place(city)
        if key in idx:
            lat, lon = idx[key]
            return GeoResult(lat, lon, "city", city.strip())

    return None


def _prefix_match(table: dict[str, tuple[float, float]], code: str) -> tuple[float, float, str] | None:
    """Average the coordinates of all postal codes sharing the longest prefix.

    Tries prefixes from one shorter than the full code down to 3 digits, returning
    the most specific (longest) prefix that has any matches.
    """
    for plen in range(len(code) - 1, 2, -1):
        prefix = code[:plen]
        pts = [v for k, v in table.items() if len(k) == len(code) and k.startswith(prefix)]
        if pts:
            lat = sum(p[0] for p in pts) / len(pts)
            lon = sum(p[1] for p in pts) / len(pts)
            return lat, lon, prefix
    return None
