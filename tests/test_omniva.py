import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from omnibox.omniva import Order, build_b2c_shipment, pick_and_build


def _order(**kw):
    base = dict(
        partner_shipment_id="T-1",
        name="Test Customer",
        email="t@example.com",
        phone="+37060000000",
        country="LT",
        postal_code="08217",
        city="Vilnius",
    )
    base.update(kw)
    return Order(**base)


def test_offload_postcode_equals_locker_id():
    out = pick_and_build(_order(), customer_code="CC")
    addr = out["payload"]["shipments"][0]["receiverAddressee"]["address"]
    assert addr["offloadPostcode"] == out["locker"]["id"]
    assert addr["country"] == "LT"


def test_payload_has_mandatory_fields():
    p = build_b2c_shipment(_order(), locker_id="88827", customer_code="CC")
    assert p["customerCode"] == "CC"
    s = p["shipments"][0]
    assert s["mainService"] == "PARCEL"
    assert s["deliveryChannel"] == "PARCEL_MACHINE"
    assert s["partnerShipmentId"] == "T-1"
    assert s["receiverAddressee"]["address"]["offloadPostcode"] == "88827"


def test_city_fallback_for_bad_postcode():
    # invalid postcode but valid city -> still builds, via city geocoding
    out = pick_and_build(_order(country="LV", postal_code="9206", city="Liepāja"), customer_code="CC")
    assert out["locker"]["country"] == "LV"
    assert "liep" in out["locker"]["city"].lower()


def test_missing_address_raises():
    try:
        pick_and_build(_order(postal_code=None, city=None), customer_code="CC")
    except ValueError:
        return
    assert False, "expected ValueError when address can't be geocoded"


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
