"""Omniva OMX API client (phase 2) — register a parcel-machine shipment and get a label.

This is the layer that lets you drop Parcely: it talks to Omniva directly. It is
built from the official OMX API manual. The crucial bridge from phase 1 is that the
locker `id` returned by ``find_nearest`` is exactly Omniva's ``offloadPostcode``.

You can use this BEFORE you have API keys: ``build_b2c_shipment`` and
``pick_and_build`` construct the exact JSON Omniva expects without sending anything,
so you can eyeball the payload now and just plug in credentials tomorrow.

Credentials (set as environment variables when you have them):
    OMNIVA_USERNAME        # XML/API username from your Account Manager
    OMNIVA_PASSWORD        # XML/API password
    OMNIVA_CUSTOMER_CODE   # partner / customer code
    OMNIVA_AGENT_ID        # optional: X-Integration-Agent-Id value
    OMNIVA_ENV             # "test" (default) or "live"
"""
from __future__ import annotations

import base64
import json
import os
import urllib.request
from dataclasses import dataclass

from .lockers import find_nearest

# OMX API base URLs (section 1.4 / 1.7 of the manual)
BASES = {
    "test": "https://test-omx.omniva.eu/api/v01/omx",
    "live": "https://omx.omniva.eu/api/v01/omx",
}


@dataclass
class OmnivaConfig:
    username: str
    password: str
    customer_code: str
    agent_id: str | None = None
    env: str = "test"

    @classmethod
    def from_env(cls) -> "OmnivaConfig":
        return cls(
            username=os.environ.get("OMNIVA_USERNAME", ""),
            password=os.environ.get("OMNIVA_PASSWORD", ""),
            customer_code=os.environ.get("OMNIVA_CUSTOMER_CODE", ""),
            agent_id=os.environ.get("OMNIVA_AGENT_ID") or None,
            env=os.environ.get("OMNIVA_ENV", "test"),
        )

    @property
    def base(self) -> str:
        return BASES[self.env]

    def is_ready(self) -> bool:
        return bool(self.username and self.password and self.customer_code)


@dataclass
class Order:
    """The minimal slice of a Shopify order we need (from the orders/create webhook)."""

    partner_shipment_id: str  # your order id/number — matches barcode in response
    name: str
    email: str
    phone: str | None
    country: str  # LT | LV | EE
    postal_code: str | None
    city: str | None
    street: str | None = None  # not needed for the locker, kept for records


def build_b2c_shipment(
    order: Order,
    locker_id: str,
    customer_code: str,
    *,
    notify_channel: str | None = None,  # "email" | "sms" | None
) -> dict:
    """Build the business-to-client shipment payload for ONE parcel to a locker.

    `locker_id` is the Omniva locker code from `find_nearest` == offloadPostcode.
    """
    receiver: dict = {
        "personName": order.name,
        "address": {
            "country": order.country,
            "offloadPostcode": str(locker_id),  # <-- the locker, the whole point
        },
    }
    if order.phone:
        receiver["contactMobile"] = order.phone
    if order.email:
        receiver["contactEmail"] = order.email

    shipment: dict = {
        "partnerShipmentId": order.partner_shipment_id,
        "mainService": "PARCEL",
        "deliveryChannel": "PARCEL_MACHINE",
        "returnAllowed": True,  # generates a return code for the recipient
        "receiverAddressee": receiver,
    }
    if notify_channel:
        shipment["notifications"] = [{"type": "DELIVERED", "channel": notify_channel}]

    return {"customerCode": customer_code, "shipments": [shipment]}


def pick_and_build(order: Order, customer_code: str, *, notify_channel: str | None = "email") -> dict:
    """Geocode the order address, pick the nearest locker, build the Omniva payload.

    Raises ValueError if the address can't be geocoded (caller should flag the order
    for manual handling instead of shipping it somewhere wrong).
    """
    res = find_nearest(order.country, postal_code=order.postal_code, city=order.city, limit=1)
    if res is None or not res.matches:
        raise ValueError(f"could not geocode order {order.partner_shipment_id}")
    locker = res.matches[0].locker
    payload = build_b2c_shipment(order, locker["id"], customer_code, notify_channel=notify_channel)
    return {"locker": locker, "distance_km": res.matches[0].distance_km, "payload": payload}


# ---------------------------------------------------------------------------
# Live calls — only run when you have credentials. No-op friendly otherwise.
# ---------------------------------------------------------------------------

def _post(cfg: OmnivaConfig, path: str, body: dict) -> dict:
    if not cfg.is_ready():
        raise RuntimeError(
            "Omniva credentials missing. Set OMNIVA_USERNAME/PASSWORD/CUSTOMER_CODE."
        )
    url = f"{cfg.base}{path}"
    data = json.dumps(body).encode("utf-8")
    token = base64.b64encode(f"{cfg.username}:{cfg.password}".encode()).decode()
    headers = {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
    }
    if cfg.agent_id:
        headers["X-Integration-Agent-Id"] = cfg.agent_id
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def register_shipment(cfg: OmnivaConfig, payload: dict) -> dict:
    """POST the shipment; response contains the barcode (tracking number)."""
    return _post(cfg, "/shipments/business-to-client", payload)


def request_label(cfg: OmnivaConfig, barcodes: list[str], *, to_email: str | None = None) -> dict:
    """Request the label PDF. With to_email Omniva emails it; otherwise base64 PDF."""
    body: dict = {
        "customerCode": cfg.customer_code,
        "barcodes": barcodes,
        "sendAddressCardTo": "EMAIL" if to_email else "RESPONSE",
    }
    if to_email:
        body["cardReceiverEmail"] = to_email
    return _post(cfg, "/shipments/package-labels", body)
