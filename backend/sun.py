"""Sonnenstand: realistische Auf-/Untergangszeiten aus Datum & Standort.

Standard-Sonnenaufgangsgleichung (NOAA-Näherung). Reine Berechnung, keine
App-/DB-Abhängigkeiten. Eingaben: lat (Nord positiv), lon (Ost positiv).
"""

import math
from datetime import datetime, timezone
from typing import Optional, Tuple

# Default-Standort (Mitte Deutschland) – falls keine Konfiguration vorhanden.
DEFAULT_LAT = 51.1657
DEFAULT_LON = 10.4515

_RAD = math.pi / 180.0


def _to_julian(dt: datetime) -> float:
    return dt.timestamp() / 86400.0 + 2440587.5


def _from_julian(jd: float) -> datetime:
    ts = (jd - 2440587.5) * 86400.0
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def sun_times(lat: float, lon: float, dt: datetime) -> Optional[Tuple[datetime, datetime]]:
    """Gibt (sunrise, sunset) als UTC-datetimes für das Datum von *dt* zurück.
    None bei Polartag/Polarnacht (Sonne geht nicht auf/unter)."""
    jd = _to_julian(dt)
    n = round(jd - 2451545.0 + 0.0008)
    Jstar = n - lon / 360.0
    M = (357.5291 + 0.98560028 * Jstar) % 360
    C = 1.9148 * math.sin(M * _RAD) + 0.0200 * math.sin(2 * M * _RAD) + 0.0003 * math.sin(3 * M * _RAD)
    lam = (M + C + 180 + 102.9372) % 360
    Jtransit = 2451545.0 + Jstar + 0.0053 * math.sin(M * _RAD) - 0.0069 * math.sin(2 * lam * _RAD)
    delta = math.asin(math.sin(lam * _RAD) * math.sin(23.4397 * _RAD))
    denom = math.cos(lat * _RAD) * math.cos(delta)
    if denom == 0:
        return None
    cos_omega = (math.sin(-0.833 * _RAD) - math.sin(lat * _RAD) * math.sin(delta)) / denom
    if cos_omega >= 1 or cos_omega <= -1:
        return None  # Polarnacht / Polartag
    omega = math.degrees(math.acos(cos_omega))
    Jrise = Jtransit - omega / 360.0
    Jset = Jtransit + omega / 360.0
    return _from_julian(Jrise), _from_julian(Jset)


def sun_intensity(now: datetime, sunrise: Optional[datetime], sunset: Optional[datetime]) -> float:
    """0..1 Sonnenintensität (Sinus-Bogen) zwischen Auf- und Untergang."""
    if sunrise is None or sunset is None or sunset <= sunrise:
        return 0.0
    if now <= sunrise or now >= sunset:
        return 0.0
    frac = (now - sunrise).total_seconds() / (sunset - sunrise).total_seconds()
    return max(0.0, math.sin(frac * math.pi))
