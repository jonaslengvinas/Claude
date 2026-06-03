"""Optional paid geocoder — exact street-level address -> coordinates.

Pluggable and cheap: at ~500 orders/month a paid geocode costs cents (Google
~$5/1000 -> ~$2.50/mo; Mapbox/HERE free tiers cover it). Results are cached on
disk so the same address is never charged twice.

Enable by setting environment variables:
    GEOCODER_PROVIDER   # "google" (default) | "here" | "mapbox"
    GEOCODER_API_KEY    # your key

If no key is set, ``geocode_via_api`` returns None and the caller falls back to
the free postal-code geocoder — so nothing breaks offline or without a key.
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from functools import lru_cache

HERE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.normpath(os.path.join(HERE_DIR, "..", "data", "geocode_cache.json"))


def _load_cache() -> dict:
    try:
        with open(CACHE_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=0)


def _cache_key(country: str, street: str, postal: str, city: str) -> str:
    return "|".join(p.strip().lower() for p in (country, street, postal, city))


@lru_cache(maxsize=1)
def _config() -> tuple[str, str | None]:
    return os.environ.get("GEOCODER_PROVIDER", "google"), os.environ.get("GEOCODER_API_KEY")


def geocode_via_api(
    country: str,
    street: str | None = None,
    postal: str | None = None,
    city: str | None = None,
) -> tuple[float, float] | None:
    """Return (lat, lon) for a full address, or None if no key / no result."""
    provider, key = _config()
    if not key:
        return None

    country, street, postal, city = (country or "", street or "", postal or "", city or "")
    ck = _cache_key(country, street, postal, city)
    cache = _load_cache()
    if ck in cache:
        v = cache[ck]
        return (v[0], v[1]) if v else None

    query = ", ".join(p for p in (street, postal, city, country) if p)
    try:
        coords = _call_provider(provider, key, query, country)
    except Exception:  # noqa: BLE001 — network/parse errors: fall back gracefully
        return None

    cache[ck] = list(coords) if coords else None
    _save_cache(cache)
    return coords


def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "omnibox-geocoder"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def _call_provider(provider: str, key: str, query: str, country: str) -> tuple[float, float] | None:
    q = urllib.parse.quote(query)
    if provider == "google":
        url = (
            "https://maps.googleapis.com/maps/api/geocode/json"
            f"?address={q}&components=country:{country}&key={key}"
        )
        data = _get_json(url)
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
        return None

    if provider == "here":
        url = f"https://geocode.search.hereapi.com/v1/geocode?q={q}&in=countryCode:{_iso3(country)}&apiKey={key}"
        data = _get_json(url)
        if data.get("items"):
            pos = data["items"][0]["position"]
            return float(pos["lat"]), float(pos["lng"])
        return None

    if provider == "mapbox":
        url = (
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/{q}.json"
            f"?country={country}&limit=1&access_token={key}"
        )
        data = _get_json(url)
        if data.get("features"):
            lon, lat = data["features"][0]["center"]
            return float(lat), float(lon)
        return None

    raise ValueError(f"unknown GEOCODER_PROVIDER {provider!r}")


def _iso3(cc: str) -> str:
    return {"LT": "LTU", "LV": "LVA", "EE": "EST"}.get(cc.upper(), cc)
