"""Find the Omniva parcel machine(s) nearest to a customer address."""
from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

from .data import load_lockers
from .geocode import geocode


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    r = 6371.0088
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


@dataclass
class LockerMatch:
    locker: dict
    distance_km: float

    def as_dict(self) -> dict:
        return {**self.locker, "distance_km": round(self.distance_km, 2)}


@dataclass
class NearestResult:
    geocode_method: str
    geocode_matched: str
    lat: float
    lon: float
    matches: list[LockerMatch]

    def as_dict(self) -> dict:
        return {
            "geocode": {
                "method": self.geocode_method,
                "matched": self.geocode_matched,
                "lat": self.lat,
                "lon": self.lon,
            },
            "lockers": [m.as_dict() for m in self.matches],
        }


def find_nearest(
    country: str,
    postal_code: str | None = None,
    city: str | None = None,
    street: str | None = None,
    *,
    limit: int = 4,
    cross_border: bool = False,
) -> NearestResult | None:
    """Geocode the address, then rank lockers by distance.

    Returns ``None`` if the address could not be geocoded at all.
    """
    geo = geocode(country, postal_code=postal_code, city=city, street=street)
    if geo is None:
        return None

    country = country.strip().upper()
    lockers = load_lockers()
    if not cross_border:
        lockers = [l for l in lockers if l["country"] == country]

    ranked = sorted(
        (LockerMatch(l, haversine_km(geo.lat, geo.lon, l["lat"], l["lon"])) for l in lockers),
        key=lambda m: m.distance_km,
    )
    return NearestResult(
        geocode_method=geo.method,
        geocode_matched=geo.matched,
        lat=geo.lat,
        lon=geo.lon,
        matches=ranked[:limit],
    )
