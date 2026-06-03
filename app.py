#!/usr/bin/env python3
"""Minimal web UI + JSON API to test the nearest-locker finder.

Run:
    python app.py
    # open http://127.0.0.1:5000

JSON API (this is the shape your Shopify order webhook would call):
    GET /api/nearest?country=LT&postal=08217&city=Vilnius&limit=4
"""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from omnibox import find_nearest

PAGE = """<!doctype html>
<html lang="lt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Artimiausias Omniva pastomatas</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 16px;color:#1a1a1a}
 h1{font-size:1.4rem} label{display:block;margin:10px 0 4px;font-weight:600;font-size:.9rem}
 input,select{width:100%;padding:10px;font-size:1rem;border:1px solid #ccc;border-radius:8px}
 button{margin-top:16px;padding:11px 18px;font-size:1rem;border:0;border-radius:8px;background:#e1530f;color:#fff;cursor:pointer}
 .row{display:flex;gap:12px}.row>div{flex:1}
 .res{margin-top:24px} .card{border:1px solid #eee;border-radius:10px;padding:12px 14px;margin:10px 0}
 .best{border-color:#e1530f;background:#fff7f3}
 .km{font-weight:700;color:#e1530f} .muted{color:#888;font-size:.85rem}
</style></head><body>
<h1>Artimiausias Omniva pastomatas</h1>
<p class="muted">Įvesk kliento adresą (kaip jis suvedamas Shopify checkout'e). Pašto kodo pakanka.</p>
<div class="row">
 <div><label>Šalis</label>
  <select id="country"><option>LT</option><option>LV</option><option>EE</option></select></div>
 <div><label>Pašto kodas</label><input id="postal" placeholder="08217"></div>
 <div><label>Miestas (nebūtina)</label><input id="city" placeholder="Vilnius"></div>
</div>
<button onclick="go()">Rasti pastomatą</button>
<div class="res" id="res"></div>
<script>
async function go(){
 const c=country.value,p=postal.value,ci=city.value;
 const r=await fetch(`/api/nearest?country=${c}&postal=${encodeURIComponent(p)}&city=${encodeURIComponent(ci)}&limit=4`);
 const d=await r.json(); const el=document.getElementById('res');
 if(!d||!d.lockers||!d.lockers.length){el.innerHTML='<p>Nepavyko rasti. Patikrink pašto kodą.</p>';return;}
 let h=`<p class="muted">Geokoduota: ${d.geocode.method} (${d.geocode.matched})</p>`;
 d.lockers.forEach((l,i)=>{h+=`<div class="card ${i?'':'best'}">
   <div><span class="km">${l.distance_km} km</span> &nbsp; <b>${l.name}</b></div>
   <div class="muted">${l.address}</div></div>`;});
 el.innerHTML=h;
}
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        u = urlparse(self.path)
        if u.path in ("/", "/index.html"):
            return self._send(200, PAGE, "text/html")
        if u.path == "/api/nearest":
            q = parse_qs(u.query)
            country = (q.get("country", [""])[0]).strip()
            postal = (q.get("postal", [""])[0]).strip() or None
            city = (q.get("city", [""])[0]).strip() or None
            limit = int(q.get("limit", ["4"])[0])
            try:
                res = find_nearest(country, postal_code=postal, city=city, limit=limit)
            except ValueError as exc:
                return self._send(400, json.dumps({"error": str(exc)}))
            return self._send(200, json.dumps(res.as_dict() if res else None, ensure_ascii=False))
        self._send(404, json.dumps({"error": "not found"}))

    def log_message(self, *_):  # silence default logging
        pass


def main(host="127.0.0.1", port=5000):
    srv = ThreadingHTTPServer((host, port), Handler)
    print(f"Serving on http://{host}:{port}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
