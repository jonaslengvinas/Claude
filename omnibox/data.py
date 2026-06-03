"""Load the normalized datasets produced by ``omnibox.fetch_data``."""
from __future__ import annotations

import csv
import json
import os
import unicodedata
from functools import lru_cache


def fold_place(name: str) -> str:
    """Normalize a place name for matching: lowercase, strip diacritics/spaces.

    'Liepāja' -> 'liepaja', 'Šiauliai' -> 'siauliai'. Lets a customer's input
    match GeoNames place names regardless of accents.
    """
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(ascii_only.strip().lower().split())

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, "..", "data"))

COUNTRIES = ("LT", "LV", "EE")


@lru_cache(maxsize=1)
def load_lockers() -> list[dict]:
    path = os.path.join(DATA_DIR, "lockers.json")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} missing. Run `python -m omnibox.fetch_data` first."
        )
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=8)
def load_postal(country: str) -> dict[str, tuple[float, float]]:
    """postal_code -> (lat, lon) for one country."""
    path = os.path.join(DATA_DIR, f"postal_{country}.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} missing. Run `python -m omnibox.fetch_data` first."
        )
    out: dict[str, tuple[float, float]] = {}
    with open(path, encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            out[row["postal_code"]] = (float(row["lat"]), float(row["lon"]))
    return out


@lru_cache(maxsize=8)
def load_city_index(country: str) -> dict[str, tuple[float, float]]:
    """lowercased place name -> mean (lat, lon), used as a fallback geocoder."""
    path = os.path.join(DATA_DIR, f"postal_{country}.csv")
    acc: dict[str, list[tuple[float, float]]] = {}
    with open(path, encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            place = fold_place(row["place"] or "")
            if place:
                acc.setdefault(place, []).append((float(row["lat"]), float(row["lon"])))
    out: dict[str, tuple[float, float]] = {}
    for place, pts in acc.items():
        out[place] = (
            sum(p[0] for p in pts) / len(pts),
            sum(p[1] for p in pts) / len(pts),
        )
    return out
