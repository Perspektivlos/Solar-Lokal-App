"""InfluxDB-Punkt-Erzeugung aus einer collect_live()-Payload (reine Funktionen)."""
from typing import Any, Dict, Optional

try:
    from influxdb_client import Point
except Exception:  # pragma: no cover
    Point = None


def _instant_ratios(summary: Dict[str, Any]) -> tuple:
    """Momentane Autarkie & Eigenverbrauch in % aus der Live-Summary."""
    hp = float(summary.get("house_power", 0) or 0)
    gp = float(summary.get("grid_power", 0) or 0)
    pv = float(summary.get("pv_power", 0) or 0)
    grid_imp = max(0.0, gp)
    grid_exp = max(0.0, -gp)
    autarky = (hp - grid_imp) / hp * 100.0 if hp > 0 else 0.0
    self_cons = (pv - grid_exp) / pv * 100.0 if pv > 0 else 0.0
    return (max(0.0, min(100.0, autarky)), max(0.0, min(100.0, self_cons)))


def _pt_solar(summary: Dict[str, Any]) -> "Point":
    """Summary-Measurement inkl. momentaner Autarkie/Eigenverbrauch."""
    def f(k: str) -> float:
        return float(summary.get(k, 0) or 0)
    autarky, self_cons = _instant_ratios(summary)
    return (
        Point("solar")
        .field("pv_power", f("pv_power"))
        .field("pv_ac_power", f("pv_ac_power"))
        .field("pv_dc_power", f("pv_dc_power"))
        .field("grid_power", f("grid_power"))
        .field("battery_power", f("battery_power"))
        .field("battery_charge_w", f("battery_charge_w"))
        .field("battery_discharge_w", f("battery_discharge_w"))
        .field("house_power", f("house_power"))
        .field("battery_soc", f("battery_soc"))
        .field("autarky_pct", round(autarky, 1))
        .field("self_consumption_pct", round(self_cons, 1))
    )


def _pts_shelly(shelly: Dict[str, Any]) -> list:
    pts = [
        Point("shelly_phase")
        .tag("phase", str(ph.get("phase", "?")))
        .field("power", float(ph.get("power", 0) or 0))
        .field("voltage", float(ph.get("voltage", 0) or 0))
        .field("current", float(ph.get("current", 0) or 0))
        .field("pf", float(ph.get("pf", 0) or 0))
        for ph in (shelly.get("phases") or [])
    ]
    if shelly.get("total_power") is not None:
        pts.append(Point("shelly").field("total_power", float(shelly.get("total_power", 0) or 0)))
    return pts


def _pts_hoymiles(ahoy: Dict[str, Any]) -> list:
    pts = []
    if ahoy.get("total_power") is not None:
        pts.append(
            Point("hoymiles")
            .field("total_power", float(ahoy.get("total_power", 0) or 0))
            .field("limit_percent", float(ahoy.get("limit_percent", 0) or 0))
        )
    pts.extend(
        Point("hoymiles_ch")
        .tag("ch", str(ch.get("ch", "?")))
        .field("power", float(ch.get("power", 0) or 0))
        .field("voltage", float(ch.get("voltage", 0) or 0))
        .field("current", float(ch.get("current", 0) or 0))
        .field("yield_day", float(ch.get("yield_day", 0) or 0))
        for ch in (ahoy.get("channels") or [])
    )
    return pts


def _pts_victron(victron: Dict[str, Any]) -> list:
    pts = []
    if victron.get("total_power") is not None:
        pts.append(Point("victron").field("total_power", float(victron.get("total_power", 0) or 0)))
    for m in (victron.get("mppts") or []):
        vp = (
            Point("victron_mppt")
            .tag("mppt", str(m.get("id", "?")))
            .field("pv_power", float(m.get("pv_power", 0) or 0))
            .field("pv_voltage", float(m.get("pv_voltage", 0) or 0))
            .field("battery_voltage", float(m.get("battery_voltage", 0) or 0))
            .field("yield_today", float(m.get("yield_today", 0) or 0))
        )
        if m.get("state") is not None:
            vp = vp.field("state", str(m.get("state")))
        pts.append(vp)
    return pts


def _pt_trucki(trucki: Dict[str, Any]) -> Optional["Point"]:
    if not trucki.get("online"):
        return None
    tp = (
        Point("trucki")
        .field("vbat", float(trucki.get("battery_voltage", 0) or 0))
        .field("ac_power", float(trucki.get("battery_power", 0) or 0))
        .field("soc", float(trucki.get("soc", 0) or 0))
        .field("zepc", 1 if trucki.get("zepc") else 0)
    )
    for src, dst in [
        ("temperature", "temperature"),
        ("ac_setpoint_w", "ac_setpoint"),
        ("ac_display_w", "ac_display"),
        ("day_energy_kwh", "day_energy"),
        ("total_energy_kwh", "total_energy"),
    ]:
        if trucki.get(src) is not None:
            tp = tp.field(dst, float(trucki.get(src, 0) or 0))
    return tp


def _build_influx_points(data: Dict[str, Any]) -> list:
    """Erzeugt einen reichen Satz InfluxDB-Punkte aus einer collect_live()-Payload.

    Measurements:
      - solar        : Summary (pv/grid/battery/house/soc + autarky/self-consumption %)
      - shelly_phase : pro Phase (tag phase=L1..L3) power/voltage/current/pf
      - shelly       : total_power
      - hoymiles     : total_power, limit_percent
      - hoymiles_ch  : pro Kanal (tag ch=1..4) power/voltage/current/yield_day
      - victron      : total_power
      - victron_mppt : pro MPPT (tag mppt=<instanz>) pv_power/pv_voltage/battery_voltage/yield_today/state
      - trucki       : vbat/ac_power/soc/zepc/temperature/ac_setpoint/ac_display/day_energy/total_energy
    """
    pts: list = [_pt_solar(data.get("summary") or {})]
    pts += _pts_shelly(data.get("shelly") or {})
    pts += _pts_hoymiles(data.get("ahoy") or {})
    pts += _pts_victron(data.get("victron") or {})
    trucki_pt = _pt_trucki(data.get("trucki") or {})
    if trucki_pt is not None:
        pts.append(trucki_pt)
    return pts
