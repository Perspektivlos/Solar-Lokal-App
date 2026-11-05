"""Isolierte API für die SmartShunt-Phase-1-Vorschau."""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from collectors import collect_live
from mqtt_client import _mqtt_state
from server import db, get_config
from smartshunt import SMARTSHUNT_INSTANCE, mock_smartshunt_history
from smartshunt_probe import probe_smartshunt


router = APIRouter(prefix="/smartshunt", tags=["smartshunt-preview"])


class IdentityChecks(BaseModel):
    product: bool
    instance: bool
    connection: bool
    connected: bool


class SmartShuntIdentity(BaseModel):
    valid: bool
    product_name: Optional[str] = None
    device_instance: Optional[int] = None
    connection: Optional[str] = None
    connected: Optional[int] = None
    product_id: Any = None
    serial: Any = None
    firmware: Any = None
    hardware: Any = None
    checks: IdentityChecks


class SmartShuntAlert(BaseModel):
    code: str
    label: str
    severity: str
    source: str


class SmartShuntCurrent(BaseModel):
    enabled: bool
    online: bool
    demo: bool
    read_only: bool
    instance: int
    status: Literal["current", "stale", "unavailable"]
    status_reason: str
    last_update: Optional[str] = None
    age_seconds: Optional[float] = None
    direction: Literal["charging", "discharging", "idle"]
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    power_w: Optional[float] = None
    soc_pct: Optional[float] = None
    time_to_go_s: Optional[float] = None
    consumed_ah: Optional[float] = None
    identity: SmartShuntIdentity
    optional: Dict[str, float]
    device_history: Dict[str, float]
    alerts: List[SmartShuntAlert]
    raw: Dict[str, Any]
    field_age_seconds: Dict[str, Optional[float]]


class DiagnosticCheck(BaseModel):
    id: str
    label: str
    ok: Optional[bool] = None
    detail: str


class SmartShuntDiagnostics(BaseModel):
    checks: List[DiagnosticCheck]
    raw_field_count: int
    message_count: int
    mqtt_connected: bool
    last_error: Optional[str] = None


class SmartShuntEvent(BaseModel):
    ts: str
    event: Literal["raised", "resolved"]
    code: str
    label: str
    severity: str
    source: Optional[str] = None
    demo: Optional[bool] = None


class SmartShuntPreviewResponse(BaseModel):
    generated_at: str
    preview: bool
    read_only: bool
    mode: Literal["demo", "live"]
    topic_base: str
    current: SmartShuntCurrent
    diagnostics: SmartShuntDiagnostics
    events: List[SmartShuntEvent]


class SmartShuntHistoryPoint(BaseModel):
    ts: str
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    power_w: Optional[float] = None
    soc_pct: Optional[float] = None
    status: Literal["current", "stale", "unavailable"]


class SmartShuntHistoryResponse(BaseModel):
    range: str
    demo: bool
    points: List[SmartShuntHistoryPoint]


class SmartShuntProbeResponse(BaseModel):
    probe_id: str
    tested_at: str
    passed: bool
    read_only: bool
    instance: int
    topic_base: str
    duration_ms: int
    message_count: int
    field_count: int
    checks: List[DiagnosticCheck]
    current: SmartShuntCurrent


@router.get("/preview", response_model=SmartShuntPreviewResponse)
async def smartshunt_preview() -> SmartShuntPreviewResponse:
    cfg = await get_config()
    data = await collect_live(cfg)
    state = data.get("smartshunt") or {}
    identity = state.get("identity") or {}
    identity_checks = identity.get("checks") or {}
    vmq = cfg.get("victron_mqtt") or {}
    topic_base = f"N/{vmq.get('vrm_id') or '<Portal-ID>'}/battery/{SMARTSHUNT_INSTANCE}/"
    demo = bool(cfg.get("demo_mode"))
    checks = [
        {"id": "mqtt", "label": "Lokale MQTT-Verbindung", "ok": None if demo else bool(_mqtt_state.get("connected")), "detail": "Demo-Datenquelle" if demo else (_mqtt_state.get("last_error") or "Broker verbunden")},
        {"id": "product", "label": "Produktname SmartShunt", "ok": bool(identity_checks.get("product")), "detail": identity.get("product_name") or "nicht empfangen"},
        {"id": "instance", "label": f"VRM-Instanz {SMARTSHUNT_INSTANCE}", "ok": bool(identity_checks.get("instance")), "detail": str(identity.get("device_instance") if identity.get("device_instance") is not None else "nicht empfangen")},
        {"id": "connection", "label": "USB / VE.Direct", "ok": bool(identity_checks.get("connection")), "detail": identity.get("connection") or "nicht empfangen"},
        {"id": "connected", "label": "Gerätestatus Connected", "ok": bool(identity_checks.get("connected")), "detail": f"Connected={identity.get('connected') if identity.get('connected') is not None else '–'}"},
        {"id": "freshness", "label": "Datenalter", "ok": state.get("status") == "current", "detail": state.get("status_reason") or "nicht verfügbar"},
        {"id": "read-only", "label": "Schreibschutz", "ok": True, "detail": "Nur N/<Portal-ID>/battery/290 wird gelesen; keine Steuerbefehle"},
    ]
    events = await db.smartshunt_alarm_events.find(
        {"demo": demo}, {"_id": 0, "expire_at": 0}
    ).sort("ts", -1).limit(30).to_list(30)
    diagnostics = {
        "checks": checks,
        "raw_field_count": len(state.get("raw") or {}),
        "message_count": int(_mqtt_state.get("messages") or 0),
        "mqtt_connected": bool(_mqtt_state.get("connected")),
        "last_error": _mqtt_state.get("last_error"),
    }
    return SmartShuntPreviewResponse(
        generated_at=datetime.now(timezone.utc).isoformat(), preview=True, read_only=True,
        mode="demo" if demo else "live", topic_base=topic_base,
        current=state, diagnostics=diagnostics, events=events,
    )


@router.get("/history", response_model=SmartShuntHistoryResponse)
async def smartshunt_history(range: str = "6h") -> SmartShuntHistoryResponse:
    allowed = {"1h": 60, "3h": 180, "6h": 360, "12h": 720, "24h": 1440}
    range_name = range if range in allowed else "6h"
    cfg = await get_config()
    demo = bool(cfg.get("demo_mode"))
    if demo:
        points = mock_smartshunt_history(range_name)
    else:
        since = (datetime.now(timezone.utc) - timedelta(minutes=allowed[range_name])).isoformat()
        projection = {"_id": 0, "ts": 1, "voltage_v": 1, "current_a": 1, "power_w": 1, "soc_pct": 1, "status": 1}
        cursor = db.smartshunt_snapshots.find(
            {"ts": {"$gte": since}, "demo": False}, projection
        ).sort("ts", -1).limit(5000)
        points = (await cursor.to_list(5000))[::-1]
        if len(points) > 600:
            points = points[::max(1, len(points) // 600)]
    return SmartShuntHistoryResponse(range=range_name, demo=demo, points=points)


@router.post("/probe", response_model=SmartShuntProbeResponse)
async def smartshunt_probe() -> SmartShuntProbeResponse:
    cfg = await get_config()
    mqtt_cfg = cfg.get("mqtt") or {}
    vrm_id = str((cfg.get("victron_mqtt") or {}).get("vrm_id") or "")
    result = await asyncio.to_thread(probe_smartshunt, mqtt_cfg, vrm_id, 10.0)
    return SmartShuntProbeResponse(**result)