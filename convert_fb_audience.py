#!/usr/bin/env python3
"""Konvertuoja Shopify klientu eksporta i Facebook value-based audience formata."""
import csv
import re
import sys

SRC = "/root/.claude/uploads/d8312fed-d337-59f0-8e24-e67a80662489/b82e9d53-customers_export_2.csv"
OUT = "/home/user/Claude/fb_audience_value_based.csv"

# Salies skambinimo kodai pagal ISO salies koda (pildoma pagal poreiki)
DIAL = {
    "LT": "370", "LV": "371", "EE": "372", "PL": "48", "DE": "49",
    "GB": "44", "US": "1", "FR": "33", "BR": "55", "ES": "34",
    "IT": "39", "SE": "46", "FI": "358", "NO": "47", "DK": "45",
    "NL": "31", "BE": "32", "IE": "353", "AT": "43", "CZ": "420",
}

# FB sablono stulpeliai (naudojame po viena email/phone)
HEADER = ["email", "phone", "fn", "ln", "zip", "ct", "st", "country", "value"]


def clean(s):
    if s is None:
        return ""
    return s.strip().lstrip("'").strip()


def norm_phone(raw, country):
    raw = clean(raw)
    if not raw:
        return ""
    has_plus = raw.strip().startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    if has_plus:
        return "+" + digits
    cc = DIAL.get(country.upper(), "")
    # Vietinis formatas su pradiniu 0 -> keiciam i salies koda
    if cc:
        if digits.startswith("00"):
            return "+" + digits[2:]
        if digits.startswith(cc):
            return "+" + digits
        if digits.startswith("0"):
            return "+" + cc + digits[1:]
        return "+" + cc + digits
    return "+" + digits


def main():
    rows_out = []
    seen_emails = set()
    skipped_no_email = 0
    test_rows = 0

    with open(SRC, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            email = clean(r.get("Email")).lower()
            if not email or "@" not in email:
                skipped_no_email += 1
                continue
            # Praleidziam testinius irasus
            if email == "test@test.com" or clean(r.get("First Name")).lower() == "test":
                test_rows += 1
                continue
            if email in seen_emails:
                continue
            seen_emails.add(email)

            country = clean(r.get("Default Address Country Code")).upper()
            phone_raw = r.get("Phone") or r.get("Default Address Phone")
            phone = norm_phone(phone_raw, country)

            value = clean(r.get("Total Spent")) or "0"

            rows_out.append([
                email,
                phone,
                clean(r.get("First Name")).lower(),
                clean(r.get("Last Name")).lower(),
                clean(r.get("Default Address Zip")).lower(),
                clean(r.get("Default Address City")).lower(),
                clean(r.get("Default Address Province Code")).lower(),
                country.lower(),
                value,
            ])

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows_out)

    print(f"Iraso failas: {OUT}")
    print(f"Eksportuota klientu: {len(rows_out)}")
    print(f"Praleista be email: {skipped_no_email}")
    print(f"Praleista testiniu: {test_rows}")
    with_phone = sum(1 for x in rows_out if x[1])
    with_value = sum(1 for x in rows_out if x[8] not in ("", "0", "0.00"))
    print(f"Su telefonu: {with_phone}")
    print(f"Su value > 0: {with_value}")


if __name__ == "__main__":
    main()
