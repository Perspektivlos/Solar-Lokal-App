from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class EMSGoals:
    autarky_pct: float = 0.0
    min_soc: float = 15.0
    max_soc: float = 95.0
    reserve_soc: float = 20.0
    avoid_export: bool = True

    @classmethod
    def from_dict(cls, payload: Dict[str, Any] | None) -> "EMSGoals":
        if payload is None:
            return cls()
        return cls(
            autarky_pct=float(payload.get("autarky_pct", 0) or 0),
            min_soc=float(payload.get("min_soc", 15) or 15),
            max_soc=float(payload.get("max_soc", 95) or 95),
            reserve_soc=float(payload.get("reserve_soc", 20) or 20),
            avoid_export=bool(payload.get("avoid_export", True)),
        )
