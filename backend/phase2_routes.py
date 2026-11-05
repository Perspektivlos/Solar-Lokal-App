"""Isolierte API für die SmartShunt-Phase-2-Vorschau."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from collectors import collect_live
from alarms import merge_thresholds
from phase2 import RANGE_MINUTES, evaluate_phase2_battery_alarms, mock_phase2_history, summarize_phase2_points
from server import db, get_config


router = APIRouter(prefix="/smartshunt-phase2", tags=["smartshunt-phase2-preview"])


class BatteryDcModel(BaseModel):
    source: str
    instance: int
    status: Literal["current", "stale", "unavailable"]
    status_reason: str
    last_update: Optional[str] = None
    age_seconds: Optional[float] = None
    power_w: Optional[float] = None
    charge_w: Optional[float] = None
    discharge_w: Optional[float] = None
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    soc_pct: Optional[float] = None
    time_to_go_s: Optional[float] = None
    consumed_ah: Optional[float] = None
    optional: Dict[str, float]


class InverterAcModel(BaseModel):
    source: str
    online: bool
    output_w: Optional[float] = None
    setpoint_w: Optional[float] = None
    reported_setpoint_w: Optional[float] = None
    min_power_w: Optional[float] = None
    max_power_w: Optional[float] = None
    zepc: Optional[bool] = None
    ac_output: Optional[bool] = None
    temperature_c: Optional[float] = None


class Phase2LiveResponse(BaseModel):
    timestamp: str
    demo_mode: bool
    preview: bool
    battery_dc: BatteryDcModel
    inverter_ac: InverterAcModel
    summary: Dict[str, Any]
    source_contract: Dict[str, str]
    alarms: List[Dict[str, Any]]
    smartshunt: Dict[str, Any]
    trucki: Dict[str, Any]
    ahoy: Dict[str, Any]
    victron: Dict[str, Any]
    shelly: Dict[str, Any]
    sun: Dict[str, Any]


class Phase2HistoryPoint(BaseModel):
    ts: str
    status: str
    battery_dc_power_w: Optional[float] = None
    battery_voltage_v: Optional[float] = None
    battery_current_a: Optional[float] = None
    battery_soc_pct: Optional[float] = None
    inverter_ac_power_w: Optional[float] = None
    pv_ac_power_w: Optional[float] = None
    pv_dc_power_w: Optional[float] = None
    house_ac_power_w: Optional[float] = None
    grid_power_w: Optional[float] = None
    battery_source_ts: Optional[str] = None


class Phase2HistoryResponse(BaseModel):
    range: str
    demo: bool
    points: List[Phase2HistoryPoint]


class Phase2TodayResponse(BaseModel):
    battery_dc_charge_kwh: float
    battery_dc_discharge_kwh: float
    inverter_ac_output_kwh: float
    pv_ac_kwh: float
    mppt_dc_kwh: float
    house_ac_kwh: float
    grid_import_kwh: float
    grid_export_kwh: float
    measurement_available: bool
    measured_duration_s: float
    battery_dc_measurement_available: bool
    battery_dc_measured_duration_s: float
    inverter_ac_measurement_available: bool
    pv_ac_measurement_available: bool
    mppt_dc_measurement_available: bool
    house_ac_measurement_available: bool
    grid_measurement_available: bool
    sample_count: int
    source_note: str


@router.get("/live", response_model=Phase2LiveResponse)
async def phase2_live() -> Phase2LiveResponse:
    cfg = await get_config()
    data = await collect_live(cfg)
    phase2 = data.get("phase2") or {}
    alarms_cfg = cfg.get("alarms") or {}
    alarms = evaluate_phase2_battery_alarms(
        data.get("smartshunt") or {}, merge_thresholds(alarms_cfg) if alarms_cfg.get("enabled", True) else {}
    )
    return Phase2LiveResponse(
        timestamp=data["timestamp"], demo_mode=bool(data.get("demo_mode")), preview=True,
        battery_dc=phase2["battery_dc"], inverter_ac=phase2["inverter_ac"],
        summary=phase2["summary"], source_contract=phase2["source_contract"], alarms=alarms,
        smartshunt=data.get("smartshunt") or {}, trucki=data.get("trucki") or {},
        ahoy=data.get("ahoy") or {}, victron=data.get("victron") or {},
        shelly=data.get("shelly") or {}, sun=data.get("sun") or {},
    )


async def _history_points(range_name: str, demo: bool, downsample: bool = False) -> List[Dict[str, Any]]:
    if demo:
        return mock_phase2_history(range_name)
    since = datetime.now(timezone.utc).timestamp() - RANGE_MINUTES[range_name] * 60
    since_iso = datetime.fromtimestamp(since, timezone.utc).isoformat()
    projection = {
        "_id": 0, "ts": 1, "smartshunt_status": 1, "smartshunt_dc_power_w": 1,
        "smartshunt_voltage_v": 1, "smartshunt_current_a": 1, "smartshunt_soc_pct": 1,
        "trucki_ac_output_w": 1, "pv_ac_power_w": 1, "pv_dc_power_w": 1,
        "house_ac_power_w": 1, "grid_power": 1, "smartshunt_received_at": 1,
    }
    cursor = db.snapshots.find(
        {"ts": {"$gte": since_iso}, "phase2_source": "smartshunt", "demo": False}, projection
    ).sort("ts", 1).limit(10000)
    rows = await cursor.to_list(10000)
    points = []
    last_source_ts = None
    for row in rows:
        source_ts = row.get("smartshunt_received_at")
        has_dc_value = any(row.get(key) is not None for key in (
            "smartshunt_dc_power_w", "smartshunt_voltage_v", "smartshunt_current_a", "smartshunt_soc_pct"
        ))
        unique_dc = row.get("smartshunt_status") == "current" and has_dc_value and (
            not source_ts or source_ts != last_source_ts
        )
        if unique_dc:
            last_source_ts = source_ts
        points.append({
            "ts": row.get("ts"), "status": row.get("smartshunt_status") or "unavailable",
            "battery_dc_power_w": row.get("smartshunt_dc_power_w") if unique_dc else None,
            "battery_voltage_v": row.get("smartshunt_voltage_v") if unique_dc else None,
            "battery_current_a": row.get("smartshunt_current_a") if unique_dc else None,
            "battery_soc_pct": row.get("smartshunt_soc_pct") if unique_dc else None,
            "inverter_ac_power_w": row.get("trucki_ac_output_w"),
            "pv_ac_power_w": row.get("pv_ac_power_w"), "pv_dc_power_w": row.get("pv_dc_power_w"),
            "house_ac_power_w": row.get("house_ac_power_w"), "grid_power_w": row.get("grid_power"),
            "battery_source_ts": source_ts,
        })
    if downsample and len(points) > 600:
        points = points[::max(1, len(points) // 600)]
    return points


@router.get("/history", response_model=Phase2HistoryResponse)
async def phase2_history(range: str = "6h") -> Phase2HistoryResponse:
    range_name = range if range in RANGE_MINUTES else "6h"
    cfg = await get_config()
    demo = bool(cfg.get("demo_mode"))
    return Phase2HistoryResponse(range=range_name, demo=demo, points=await _history_points(range_name, demo, downsample=True))


@router.get("/today", response_model=Phase2TodayResponse)
async def phase2_today() -> Phase2TodayResponse:
    cfg = await get_config()
    demo = bool(cfg.get("demo_mode"))
    points = await _history_points("24h", demo)
    midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    points = [point for point in points if datetime.fromisoformat(point["ts"]) >= midnight]
    return Phase2TodayResponse(**summarize_phase2_points(points))