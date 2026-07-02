from datetime import datetime

from core.engine import DecisionEngine
from core.goals import EMSGoals
from core.graph import EnergyGraph
from core.manager import EnergyManager
from core.models import EnergyNode, EnergyEdge, NodeType


def test_energy_graph_node_updates():
    graph = EnergyGraph()
    graph.add_node(EnergyNode(id="pv", type=NodeType.PV, label="PV", power_w=1000.0))
    graph.update_node_power("pv", 1200.0, state="active")
    node = graph.nodes["pv"]
    assert node.power_w == 1200.0
    assert node.state == "active"


def test_energy_manager_default_graph():
    manager = EnergyManager()
    assert "pv" in manager.graph.nodes
    assert "battery" in manager.graph.nodes
    assert any(edge.source == "pv" and edge.target == "house" for edge in manager.graph.edges)


def test_decision_engine_charging_intent():
    graph = EnergyGraph()
    graph.add_node(EnergyNode(id="pv", type=NodeType.PV, label="PV", power_w=3000.0))
    graph.add_node(EnergyNode(id="battery", type=NodeType.BATTERY, label="Battery", power_w=-500.0, metadata={"max_charge_w": 1500, "soc": 40.0}))
    graph.add_node(EnergyNode(id="house", type=NodeType.HOUSE, label="House", power_w=1000.0))
    graph.add_node(EnergyNode(id="grid", type=NodeType.GRID, label="Grid", power_w=0.0))
    graph.add_edge(EnergyEdge(source="pv", target="house"))
    graph.add_edge(EnergyEdge(source="pv", target="battery"))

    engine = DecisionEngine(graph, EMSGoals(autarky_pct=70, min_soc=15, max_soc=95, reserve_soc=20, avoid_export=True))
    intents = engine.evaluate()
    assert any(intent.action == "charge" for intent in intents)


def test_decision_engine_export_intent_when_battery_full():
    graph = EnergyGraph()
    graph.add_node(EnergyNode(id="pv", type=NodeType.PV, label="PV", power_w=2000.0))
    graph.add_node(EnergyNode(id="battery", type=NodeType.BATTERY, label="Battery", power_w=0.0, metadata={"max_charge_w": 1500, "soc": 95.0}))
    graph.add_node(EnergyNode(id="house", type=NodeType.HOUSE, label="House", power_w=500.0))
    graph.add_node(EnergyNode(id="grid", type=NodeType.GRID, label="Grid", power_w=0.0))
    graph.add_edge(EnergyEdge(source="pv", target="house"))

    engine = DecisionEngine(graph, EMSGoals(autarky_pct=70, min_soc=15, max_soc=95, reserve_soc=20, avoid_export=True))
    intents = engine.evaluate()
    assert any(intent.action == "export" for intent in intents)


def test_decision_engine_import_intent_when_house_deficit():
    graph = EnergyGraph()
    graph.add_node(EnergyNode(id="pv", type=NodeType.PV, label="PV", power_w=500.0))
    graph.add_node(EnergyNode(id="battery", type=NodeType.BATTERY, label="Battery", power_w=0.0, metadata={"max_discharge_w": 2000}))
    graph.add_node(EnergyNode(id="house", type=NodeType.HOUSE, label="House", power_w=1200.0))
    graph.add_node(EnergyNode(id="grid", type=NodeType.GRID, label="Grid", power_w=700.0))
    graph.add_edge(EnergyEdge(source="pv", target="house"))

    engine = DecisionEngine(graph)
    intents = engine.evaluate()
    assert any(intent.action == "import" for intent in intents)
