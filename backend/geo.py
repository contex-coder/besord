"""Geolocation helpers — derive country/region/city from request IP."""
import os
import httpx
from typing import Optional

# Free, no-key IP geolocation. 45 req/min limit.
GEO_API = "http://ip-api.com/json"

_cache: dict[str, dict] = {}


def get_client_ip(headers: dict, fallback: Optional[str] = None) -> Optional[str]:
    fwd = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    real = headers.get("x-real-ip") or headers.get("X-Real-IP")
    return real or fallback


async def geo_lookup(ip: Optional[str]) -> dict:
    """Returns {country, country_code, region, region_code, city, lat, lon}."""
    empty = {"country": None, "country_code": None, "region": None, "region_code": None, "city": None, "lat": None, "lon": None}
    if not ip or ip.startswith(("127.", "10.", "192.168.", "172.")) or ip == "::1":
        return empty
    if ip in _cache:
        return _cache[ip]
    try:
        async with httpx.AsyncClient(timeout=4.0) as http:
            r = await http.get(f"{GEO_API}/{ip}?fields=status,country,countryCode,regionName,region,city,lat,lon")
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "success":
                    out = {
                        "country": data.get("country"),
                        "country_code": data.get("countryCode"),
                        "region": data.get("regionName"),
                        "region_code": data.get("region"),
                        "city": data.get("city"),
                        "lat": data.get("lat"),
                        "lon": data.get("lon"),
                    }
                    _cache[ip] = out
                    return out
    except Exception:
        pass
    return empty
