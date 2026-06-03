"""Download and normalize the datasets the locker finder needs.

Two data sources are used:

1. Omniva parcel-machine locations (name + coordinates of every locker).
   Production should pull the *live* file straight from Omniva; it changes as
   lockers are added/removed. The GitHub mirror is only a fallback so the tool
   keeps working in restricted/offline environments (e.g. CI sandboxes).

2. GeoNames postal-code -> lat/lon tables for LT/LV/EE. This is what turns a
   customer's postal code into coordinates, with no paid geocoding API.

Run this whenever you want to refresh the cached data:

    python -m omnibox.fetch_data

The normalized output lands in ``data/lockers.json`` and ``data/postal_<cc>.csv``
and is what the runtime (``omnibox.data``) actually reads.
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, "..", "data"))

COUNTRIES = ("LT", "LV", "EE")

# Live source (preferred in production). Per-country file is identical content.
OMNIVA_LIVE_URL = "https://www.omniva.lt/locations.json"
# Mirror that works inside locked-down/allowlisted environments.
OMNIVA_MIRROR_URL = (
    "https://raw.githubusercontent.com/mijora/omniva-prestahop-1.7/master/locations.json"
)
# GeoNames postal data mirror (same data pgeocode uses).
POSTAL_URL = (
    "https://raw.githubusercontent.com/symerio/postal-codes-data/master/data/geonames/{cc}.txt"
)

UA = {"User-Agent": "Mozilla/5.0 (omnibox locker-finder)"}


def _get(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _read_local(name: str) -> bytes | None:
    """Use a staged raw file if present (lets us build with no network)."""
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        with open(path, "rb") as fh:
            return fh.read()
    return None


def fetch_omniva_raw() -> list[dict]:
    raw = _read_local("_raw_omniva.json")
    if raw is None:
        for url in (OMNIVA_LIVE_URL, OMNIVA_MIRROR_URL):
            try:
                raw = _get(url)
                break
            except Exception as exc:  # noqa: BLE001
                print(f"  ! {url} failed: {exc}", file=sys.stderr)
        if raw is None:
            raise RuntimeError("could not fetch Omniva locations from any source")
    return json.loads(raw)


def _clean(value: str | None) -> str:
    if not value or value == "NULL":
        return ""
    return value.strip()


def normalize_lockers(records: list[dict]) -> list[dict]:
    """Keep only parcel machines (TYPE == '0') with valid coordinates."""
    out: list[dict] = []
    for r in records:
        country = _clean(r.get("A0_NAME"))
        if country not in COUNTRIES:
            continue
        if str(r.get("TYPE")) != "0":  # 0 = parcel machine, 1 = post office
            continue
        try:
            lon = float(r["X_COORDINATE"])
            lat = float(r["Y_COORDINATE"])
        except (KeyError, ValueError, TypeError):
            continue
        street = " ".join(p for p in (_clean(r.get("A5_NAME")), _clean(r.get("A7_NAME"))) if p)
        city = _clean(r.get("A3_NAME")) or _clean(r.get("A2_NAME"))
        address = ", ".join(p for p in (street, city) if p)
        out.append(
            {
                "id": _clean(r.get("ZIP")),  # Omniva's own locker code
                "name": _clean(r.get("NAME")),
                "country": country,
                "city": city,
                "address": address,
                "lat": lat,
                "lon": lon,
            }
        )
    return out


def build_postal(cc: str) -> list[tuple[str, float, float, str]]:
    """Return unique (postal_code, lat, lon, place) rows for a country."""
    raw = _read_local(f"_raw_postal_{cc}.txt")
    if raw is None:
        raw = _get(POSTAL_URL.format(cc=cc))
    seen: dict[str, tuple[str, float, float, str]] = {}
    reader = csv.reader(io.StringIO(raw.decode("utf-8")), delimiter="\t")
    for row in reader:
        # GeoNames columns: country, postal, place, admin1, a1, admin2, a2,
        # admin3, a3, lat, lon, accuracy
        if len(row) < 11:
            continue
        postal = normalize_postal(row[1])
        place = row[2].strip()
        try:
            lat = float(row[9])
            lon = float(row[10])
        except ValueError:
            continue
        if postal and postal not in seen:
            seen[postal] = (postal, lat, lon, place)
    return list(seen.values())


def normalize_postal(value: str) -> str:
    """Strip country prefixes/spaces: 'LT-12345' -> '12345'."""
    if not value:
        return ""
    value = value.strip().upper()
    for cc in COUNTRIES:
        if value.startswith(cc + "-"):
            value = value[len(cc) + 1 :]
        elif value.startswith(cc):
            value = value[len(cc) :]
    return "".join(ch for ch in value if ch.isdigit())


def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)

    print("Building lockers.json ...")
    lockers = normalize_lockers(fetch_omniva_raw())
    with open(os.path.join(DATA_DIR, "lockers.json"), "w", encoding="utf-8") as fh:
        json.dump(lockers, fh, ensure_ascii=False, indent=1)
    by_country: dict[str, int] = {}
    for l in lockers:
        by_country[l["country"]] = by_country.get(l["country"], 0) + 1
    print(f"  {len(lockers)} parcel machines  {by_country}")

    for cc in COUNTRIES:
        print(f"Building postal_{cc}.csv ...")
        rows = build_postal(cc)
        path = os.path.join(DATA_DIR, f"postal_{cc}.csv")
        with open(path, "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["postal_code", "lat", "lon", "place"])
            w.writerows(rows)
        print(f"  {len(rows)} unique postal codes")

    print("Done.")


if __name__ == "__main__":
    main()
