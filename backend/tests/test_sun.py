"""Tests für Sonnenstand/Auf-/Untergangszeiten (sun.py)."""
from datetime import datetime, timezone

import sun


def test_sun_times_germany_summer_long_day():
    dt = datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc)
    sr, ss = sun.sun_times(51.16, 10.45, dt)
    assert sr < ss
    day_len = (ss - sr).total_seconds() / 3600
    assert day_len > 15  # langer Sommertag


def test_sun_times_winter_shorter_than_summer():
    summer = sun.sun_times(51.16, 10.45, datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc))
    winter = sun.sun_times(51.16, 10.45, datetime(2026, 12, 21, 12, 0, tzinfo=timezone.utc))
    ls = (summer[1] - summer[0]).total_seconds()
    lw = (winter[1] - winter[0]).total_seconds()
    assert ls > lw
    assert (lw / 3600) < 9  # kurzer Wintertag


def test_sun_intensity_day_night():
    sr = datetime(2026, 6, 21, 3, 0, tzinfo=timezone.utc)
    ss = datetime(2026, 6, 21, 19, 0, tzinfo=timezone.utc)
    assert sun.sun_intensity(datetime(2026, 6, 21, 11, 0, tzinfo=timezone.utc), sr, ss) > 0.95
    assert sun.sun_intensity(datetime(2026, 6, 21, 1, 0, tzinfo=timezone.utc), sr, ss) == 0.0
    assert sun.sun_intensity(datetime(2026, 6, 21, 20, 0, tzinfo=timezone.utc), sr, ss) == 0.0


def test_sun_times_returns_utc():
    sr, ss = sun.sun_times(51.16, 10.45, datetime(2026, 3, 20, 12, 0, tzinfo=timezone.utc))
    assert sr.tzinfo is not None and ss.tzinfo is not None
    # Äquinoktium: Tageslänge ~12 h
    day_len = (ss - sr).total_seconds() / 3600
    assert 11.5 < day_len < 12.7
