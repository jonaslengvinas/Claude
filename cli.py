#!/usr/bin/env python3
"""Test the locker finder from the command line.

Examples:
    python cli.py LT 08217 Vilnius
    python cli.py LV LV-1050
    python cli.py EE 10115 --limit 5
    python cli.py --demo            # run a batch of example addresses
"""
from __future__ import annotations

import argparse
import json

from omnibox import find_nearest

DEMO = [
    ("LT", "08217", "Vilnius"),
    ("LT", "44001", "Kaunas"),
    ("LT", "91001", "Klaipeda"),
    ("LV", "1050", "Riga"),
    ("LV", "3001", "Jelgava"),
    ("EE", "10115", "Tallinn"),
    ("EE", "51004", "Tartu"),
]


def show(country, postal, city, limit):
    res = find_nearest(country, postal_code=postal, city=city, limit=limit)
    header = f"{country}  postal={postal or '-'}  city={city or '-'}"
    if res is None:
        print(f"\n{header}\n  ! could not geocode this address")
        return
    g = res
    print(
        f"\n{header}"
        f"\n  geocoded via {g.geocode_method} ({g.geocode_matched}) "
        f"-> {g.lat:.4f}, {g.lon:.4f}"
    )
    for i, m in enumerate(res.matches):
        mark = "->" if i == 0 else "  "
        print(f"  {mark} {m.distance_km:6.2f} km  {m.locker['name']}  [{m.locker['address']}]")


def main():
    ap = argparse.ArgumentParser(description="Nearest Omniva parcel machine finder")
    ap.add_argument("country", nargs="?", help="LT | LV | EE")
    ap.add_argument("postal", nargs="?", help="postal code, e.g. 08217 or LT-08217")
    ap.add_argument("city", nargs="?", help="city / place name (fallback)")
    ap.add_argument("--limit", type=int, default=4, help="how many lockers to show")
    ap.add_argument("--demo", action="store_true", help="run built-in example addresses")
    ap.add_argument("--json", action="store_true", help="print raw JSON result")
    args = ap.parse_args()

    if args.demo:
        for c, p, city in DEMO:
            show(c, p, city, args.limit)
        return

    if not args.country:
        ap.error("provide COUNTRY POSTAL [CITY], or use --demo")

    if args.json:
        res = find_nearest(args.country, postal_code=args.postal, city=args.city, limit=args.limit)
        print(json.dumps(res.as_dict() if res else None, ensure_ascii=False, indent=2))
    else:
        show(args.country, args.postal, args.city, args.limit)


if __name__ == "__main__":
    main()
