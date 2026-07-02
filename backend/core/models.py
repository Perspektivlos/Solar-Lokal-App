from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class NodeType(str, Enum):
    PV = "pv"
    BATTERY = "battery"
    GRID = "grid"
    HOUSE = "house"
    CONSUMER = "consumer"
    PRODUCER = "producer"


@dataclass
class EnergyNode:
    id: str
    type: NodeType
    label: str
    power_w: float = 0.0
    state: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    inputs: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)

    def is_source(self) -> bool:
        return self.type in {NodeType.PV, NodeType.PRODUCER}

    def is_sink(self) -> bool:
        return self.type in {NodeType.HOUSE, NodeType.CONSUMER}

    def is_storage(self) -> bool:
        return self.type == NodeType.BATTERY


@dataclass
class EnergyEdge:
    source: str
    target: str
    capacity_w: Optional[float] = None
    priority: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EnergyGraphSnapshot:
    timestamp: datetime
    nodes: Dict[str, EnergyNode]
    edges: List[EnergyEdge]
    summary: Dict[str, Any] = field(default_factory=dict)
