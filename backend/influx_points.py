"""InfluxDB-Punkt-Erzeugung aus einer collect_live()-Payload (reine Funktionen)."""
from typing import Any, Dict, Optional

try:
    from influxdb_client import Point
except Exception:  # pragma: no cover
    Point = None


def _instant_ratios(summary: Dict[str, Any]) -> tuple:
    """
    Berechnet die momentane Autarkie und den Eigenverbrauch.
    
    Parameters:
        summary (Dict[str, Any]): Live-Summary mit Haus-, Netz- und PV-Leistung.
    
    Returns:
        tuple: Ein Tupel mit Autarkie und Eigenverbrauch in Prozent, jeweils auf
            den Bereich von 0 bis 100 begrenzt.
    """
    hp = float(summary.get("house_power", 0) or 0)
    gp = float(summary.get("grid_power", 0) or 0)
    pv = float(summary.get("pv_power", 0) or 0)
    grid_imp = max(0.0, gp)
    grid_exp = max(0.0, -gp)
    autarky = (hp - grid_imp) / hp * 100.0 if hp > 0 else 0.0
    self_cons = (pv - grid_exp) / pv * 100.0 if pv > 0 else 0.0
    return (max(0.0, min(100.0, autarky)), max(0.0, min(100.0, self_cons)))


def _pt_solar(summary: Dict[str, Any]) -> "Point":
    """
    Erstellt einen InfluxDB-Messpunkt mit Solar-, Netz-, Batterie- und Haushaltsdaten.
    
    Parameters:
    	summary (Dict[str, Any]): Zusammenfassung der aktuellen Energie- und Leistungswerte.
    
    Returns:
    	Point: Solar-Messpunkt mit numerischen Messwerten sowie Autarkie- und Eigenverbrauchsanteilen in Prozent.
    """
    def f(k: str) -> float:
        """
        Wandelt den unter einem Schlüssel gespeicherten Wert in eine Gleitkommazahl um.
        
        Parameters:
        	k (str): Schlüssel des auszulesenden Werts.
        
        Returns:
        	float: Der konvertierte Wert oder 0.0, wenn kein Wert vorhanden ist.
        """
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
    """
    Erstellt InfluxDB-Messpunkte für die Shelly-Phasen und optional die Gesamtleistung.
    
    Parameters:
    	shelly (Dict[str, Any]): Shelly-Daten mit Phasenmessungen und optionaler Gesamtleistung.
    
    Returns:
    	list: Messpunkte für die einzelnen Phasen sowie gegebenenfalls für die Gesamtleistung.
    """
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
    """
    Erzeugt InfluxDB-Punkte für die Hoymiles-Gesamtleistung und die einzelnen Kanäle.
    
    Parameters:
    	ahoy (Dict[str, Any]): Hoymiles-Daten mit optionaler Gesamtleistung, Leistungsbegrenzung und Kanalmesswerten.
    
    Returns:
    	list: InfluxDB-Punkte für die Gesamtleistung und die konfigurierten Hoymiles-Kanäle.
    """
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
    """
    Erstellt InfluxDB-Punkte für die Victron-Gesamtleistung und die einzelnen MPPT-Laderegler.
    
    Parameters:
    	victron (Dict[str, Any]): Victron-Daten mit optionaler Gesamtleistung und MPPT-Messwerten.
    
    Returns:
    	list: InfluxDB-Punkte für die Gesamtleistung und die konfigurierten MPPT-Laderegler.
    """
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
    """
    Erstellt einen InfluxDB-Punkt für ein online verfügbares Trucki-Gerät.
    
    Parameters:
    	trucki (Dict[str, Any]): Trucki-Daten einschließlich Online-Status und Messwerten.
    
    Returns:
    	Optional[Point]: Der Trucki-Punkt oder `None`, wenn das Gerät offline ist.
    """
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
    """
    Erzeugt InfluxDB-Punkte aus einer Live-Daten-Payload.
    
    Parameters:
        data (Dict[str, Any]): Von `collect_live()` gelieferte Daten.
    
    Returns:
        list: Solar-, Geräte- und optional ein Trucki-Punkt.
    """
    pts: list = [_pt_solar(data.get("summary") or {})]
    pts += _pts_shelly(data.get("shelly") or {})
    pts += _pts_hoymiles(data.get("ahoy") or {})
    pts += _pts_victron(data.get("victron") or {})
    trucki_pt = _pt_trucki(data.get("trucki") or {})
    if trucki_pt is not None:
        pts.append(trucki_pt)
    return pts
