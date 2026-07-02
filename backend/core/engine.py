from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .goals import EMSGoals
from .graph import EnergyGraph
from .models import EnergyNode


@dataclass
class DecisionIntent:
    node_id: str
    action: str
    value: float
    reason: str
    priority: int = 0


class DecisionEngine:
    def __init__(self, graph: EnergyGraph, goals: EMSGoals | None = None) -> None:
        self.graph = graph
        self.goals = goals or EMSGoals()

    def evaluate(self) -> List[DecisionIntent]:
        intents: List[DecisionIntent] = []
        pv_total = sum(n.power_w for n in self.graph.nodes.values() if n.type == "pv")
        battery = next((n for n in self.graph.nodes.values() if n.type == "battery"), None)
        house = next((n for n in self.graph.nodes.values() if n.type == "house"), None)
        grid = next((n for n in self.graph.nodes.values() if n.type == "grid"), None)

        if battery is None or house is None or grid is None:
            return intents

        battery_soc = float(battery.metadata.get("soc", 0) or 0)
        max_charge = abs(float(battery.metadata.get("max_charge_w", 5000) or 5000))
        max_discharge = abs(float(battery.metadata.get("max_discharge_w", 5000) or 5000))
        surplus = max(0.0, pv_total - house.power_w)
        house_deficit = max(0.0, house.power_w - pv_total)

        if surplus > 0:
            if battery_soc < self.goals.max_soc:
                charge_value = min(surplus, max_charge)
                if charge_value > 0:
                    reason = "PV surplus"
                    priority = 10
                    if battery_soc < self.goals.reserve_soc:
                        reason = "Reserve aufbauen"
                        priority = 12
                    intents.append(DecisionIntent(
                        node_id=battery.id,
                        action="charge",
                        value=charge_value,
                        reason=reason,
                        priority=priority,
                    ))
            elif self.goals.avoid_export:
                intents.append(DecisionIntent(
                    node_id=grid.id,
                    action="export",
                    value=surplus,
                    reason="Battery voll / überschüssige PV",
                    priority=3,
                ))

        if house_deficit > 0 and battery_soc > self.goals.min_soc:
            discharge_value = min(house_deficit, max_discharge)
            if discharge_value > 0:
                reason = "House deficit"
                priority = 11 if self.goals.autarky_pct > 0 else 9
                intents.append(DecisionIntent(
                    node_id=battery.id,
                    action="discharge",
                    value=discharge_value,
                    reason=reason,
                    priority=priority,
                ))
                house_deficit -= discharge_value

        if house_deficit > 0:
            intents.append(DecisionIntent(
                node_id=grid.id,
                action="import",
                value=house_deficit,
                reason="PV + Akku reichen nicht",
                priority=8,
            ))

        return sorted(intents, key=lambda i: (-i.priority, i.node_id, i.action))
