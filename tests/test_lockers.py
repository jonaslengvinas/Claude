import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from omnibox import find_nearest, haversine_km
from omnibox.geocode import geocode


def test_haversine_known_distance():
    # Vilnius <-> Kaunas ~ 92 km
    d = haversine_km(54.6872, 25.2797, 54.8985, 23.9036)
    assert 85 < d < 100


def test_geocode_postal_lt():
    g = geocode("LT", postal_code="08217")
    assert g is not None
    assert 54.0 < g.lat < 55.5  # Vilnius region
    assert g.method in ("postal", "postal_prefix")


def test_geocode_with_country_prefix():
    g = geocode("LV", postal_code="LV-1050")
    assert g is not None
    assert g.method in ("postal", "postal_prefix")


def test_postal_prefix_fallback_stays_in_district():
    # 04140 is absent from the free dataset; prefix '041' should keep us in SW
    # Vilnius (Lazdynai area), NOT the generic city centre.
    g = geocode("LT", postal_code="04140", city="Vilnius")
    assert g is not None
    assert g.method == "postal_prefix"
    assert g.lat < 54.69  # south-west of the city centre


def test_nearest_returns_same_country_only():
    res = find_nearest("LT", postal_code="08217", limit=5)
    assert res is not None
    assert res.matches, "expected at least one locker"
    assert all(m.locker["country"] == "LT" for m in res.matches)


def test_nearest_is_sorted_and_close():
    res = find_nearest("LT", postal_code="44001", city="Kaunas", limit=4)
    assert res is not None
    dists = [m.distance_km for m in res.matches]
    assert dists == sorted(dists)
    assert dists[0] < 25  # nearest locker should be within the city-ish
    # top match should actually be in Kaunas
    assert any("kaun" in m.locker["name"].lower() or "kaun" in m.locker["address"].lower()
               for m in res.matches)


def test_unknown_country_raises():
    try:
        find_nearest("PL", postal_code="00001")
    except ValueError:
        return
    assert False, "expected ValueError for unsupported country"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
            passed += 1
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL {fn.__name__}: {exc}")
    print(f"\n{passed}/{len(fns)} passed")
    sys.exit(0 if passed == len(fns) else 1)
