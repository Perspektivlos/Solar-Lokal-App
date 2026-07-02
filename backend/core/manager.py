from __future__ import annotations

from .engine import DecisionEngine
from .goals import EMSGoals
from .graph import EnergyGraph
from .models import EnergyEdge, EnergyNode, NodeType


class EnergyManager:
    def __init__(self, goals: EMSGoals | None = None) -> None:
        self.goals = goals or EMSGoals()
        self.graph = EnergyGraph()
        self.build_default_graph()
        self.engine = DecisionEngine(self.graph, self.goals)

    def build_default_graph(self) -> None:
        self.graph = EnergyGraph()
        self.graph.add_node(EnergyNode(id="pv", type=NodeType.PV, label="PV", power_w=0.0))
        self.graph.add_node(EnergyNode(id="battery", type=NodeType.BATTERY, label="Battery", power_w=0.0, metadata={"max_charge_w": 3000, "max_discharge_w": 3000, "soc": 50.0}))
        self.graph.add_node(EnergyNode(id="house", type=NodeType.HOUSE, label="House", power_w=0.0))
        self.graph.add_node(EnergyNode(id="grid", type=NodeType.GRID, label="Grid", power_w=0.0))
        self.graph.add_edge(EnergyEdge(source="pv", target="house", priority=10))
        self.graph.add_edge(EnergyEdge(source="pv", target="battery", priority=9))
        self.graph.add_edge(EnergyEdge(source="battery", target="house", priority=8))
        self.graph.add_edge(EnergyEdge(source="grid", target="house", priority=1))

    def set_goals(self, goals: EMSGoals) -> None:
        self.goals = goals
        self.engine.goals = goals

    def update_node(self, node_id: str, power_w: float, state: str | None = None, metadata: dict | None = None) -> None:
        self.graph.update_node_power(node_id, power_w, state)
        if metadata:
            node = self.graph.nodes.get(node_id)
            if node:
                node.metadata.update(metadata)

    def evaluate(self) -> list:
        return self.engine.evaluate()

    def snapshot(self) -> dict:
        return self.graph.snapshot(summary={
            "nodes": {k: {"power_w": v.power_w, "state": v.state, "metadata": v.metadata} for k, v in self.graph.nodes.items()}
        }).__dict__
