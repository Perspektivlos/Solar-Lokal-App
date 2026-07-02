from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

from .models import EnergyEdge, EnergyGraphSnapshot, EnergyNode


@dataclass
class EnergyGraph:
    nodes: Dict[str, EnergyNode] = field(default_factory=dict)
    edges: List[EnergyEdge] = field(default_factory=list)

    def add_node(self, node: EnergyNode) -> None:
        self.nodes[node.id] = node

    def add_edge(self, edge: EnergyEdge) -> None:
        self.edges.append(edge)
        if edge.source in self.nodes:
            self.nodes[edge.source].outputs.append(edge.target)
        if edge.target in self.nodes:
            self.nodes[edge.target].inputs.append(edge.source)

    def update_node_power(self, node_id: str, power_w: float, state: Optional[str] = None) -> None:
        node = self.nodes.get(node_id)
        if not node:
            return
        node.power_w = power_w
        if state is not None:
            node.state = state

    def snapshot(self, summary: Optional[Dict[str, any]] = None) -> EnergyGraphSnapshot:
        return EnergyGraphSnapshot(timestamp=datetime.utcnow(), nodes=self.nodes.copy(), edges=list(self.edges), summary=summary or {})
