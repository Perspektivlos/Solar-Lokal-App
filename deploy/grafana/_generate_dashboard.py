#!/usr/bin/env python3
"""Generator für das Solar-SCADA-Grafana-Dashboard.

Erzeugt ein schema-konsistentes Dashboard (schemaVersion 39, Flux, Datasource-uid
`influxdb-solar`, Variablen ${bucket}/${mode}) im Design der App. Deckt ALLE vom
Poller nach InfluxDB geschriebenen Measurements/Felder ab und nutzt die installierten
Plugins D3 Gauge (briangann-gauge-panel), Pareto (isaozler-paretochart-panel) und Stat.

Schreibt identisch nach:
  - provisioning/dashboards/json/solar-scada.json   (Auto-Provisioning)
  - solar-scada-dashboard.json                      (manueller Import)
"""
import json
import os

DS = {"type": "influxdb", "uid": "influxdb-solar"}

# App-Design: SCADA-Dark, Neon-Farben
C = {
    "pv": "#FACC15", "pv_dc": "#F59E0B", "grid_imp": "#F87171", "grid_exp": "#10B981",
    "battery": "#06B6D4", "house": "#CBD5E1", "cyan": "#22D3EE", "warn": "#FBBF24",
    "crit": "#EF4444", "ok": "#10B981", "violet": "#A78BFA", "teal": "#2DD4BF",
}
PHASE = ["#60A5FA", "#F59E0B", "#34D399"]      # L1/L2/L3
CHAN = ["#FDE047", "#FACC15", "#F59E0B", "#FB923C"]  # Hoymiles Kanäle
MPPTC = ["#FACC15", "#34D399"]                 # MPPT 1/2

_id = [10]
def nid():
    _id[0] += 1
    return _id[0]


def flux(meas, field, agg="mean", group=None, last=False):
    q = (
        'from(bucket: "${bucket}")\n'
        '  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n'
        f'  |> filter(fn: (r) => r._measurement == "{meas}" and r._field == "{field}" and r.mode == "${{mode}}")\n'
    )
    if last:
        q += "  |> last()\n"
        if group:
            q += f'  |> group(columns: ["{group}"])\n'
    else:
        q += f"  |> aggregateWindow(every: v.windowPeriod, fn: {agg}, createEmpty: false)\n"
        if group:
            q += f'  |> group(columns: ["{group}"])\n'
        else:
            q += '  |> keep(columns: ["_time", "_value", "_field"])\n'
    return q


def targets(specs):
    out = []
    for i, (meas, field, kw) in enumerate(specs):
        out.append({"refId": chr(65 + i), "datasource": DS, "query": flux(meas, field, **kw)})
    return out


def override(regexp, color, name):
    props = [{"id": "color", "value": {"mode": "fixed", "fixedColor": color}}]
    if name:
        props.append({"id": "displayName", "value": name})
    return {"matcher": {"id": "byRegexp", "options": regexp}, "properties": props}


def row(title, y):
    return {"type": "row", "title": title, "collapsed": False, "panels": [],
            "gridPos": {"h": 1, "w": 24, "x": 0, "y": y}}


def timeseries(title, x, y, w, h, specs, unit="watt", overrides=None, stack=False, fill=12, axisPlacement=None):
    custom = {"drawStyle": "line", "lineWidth": 2, "fillOpacity": fill, "showPoints": "never",
              "spanNulls": True, "gradientMode": "opacity"}
    if stack:
        custom["stacking"] = {"mode": "normal", "group": "A"}
    if axisPlacement:
        custom["axisPlacement"] = axisPlacement
    return {
        "type": "timeseries", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {"unit": unit, "custom": custom, "color": {"mode": "palette-classic"}},
                        "overrides": overrides or []},
        "options": {"legend": {"displayMode": "table", "placement": "bottom", "calcs": ["last", "min", "max"]},
                    "tooltip": {"mode": "multi", "sort": "desc"}},
        "targets": targets(specs),
    }


def stat(title, x, y, w, h, specs, unit="watt", color=None, thresholds=None, decimals=0, graph=True):
    steps = thresholds or [{"color": color or "text", "value": None}]
    return {
        "type": "stat", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {
            "unit": unit, "decimals": decimals,
            "color": {"mode": "fixed", "fixedColor": color} if color else {"mode": "thresholds"},
            "thresholds": {"mode": "absolute", "steps": steps}}, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "orientation": "auto", "textMode": "value_and_name", "colorMode": "value",
                    "graphMode": "area" if graph else "none", "justifyMode": "auto"},
        "targets": targets(specs),
    }


def gauge_builtin(title, x, y, w, h, specs, unit="percent", steps=None, maxv=100):
    steps = steps or [{"color": C["crit"], "value": None}, {"color": C["warn"], "value": 40}, {"color": C["ok"], "value": 70}]
    return {
        "type": "gauge", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {"unit": unit, "min": 0, "max": maxv,
            "color": {"mode": "thresholds"}, "thresholds": {"mode": "absolute", "steps": steps}}, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "showThresholdLabels": False, "showThresholdMarkers": True},
        "targets": targets(specs),
    }


def d3gauge(title, x, y, w, h, specs, unit="percent", maxv=100, thresholds="40,70"):
    # Plugin: D3 Gauge (briangann-gauge-panel)
    return {
        "type": "briangann-gauge-panel", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {"unit": unit, "min": 0, "max": maxv}, "overrides": []},
        "options": {
            "decimals": 0, "format": unit, "gaugeRadius": 0, "maxValue": maxv, "minValue": 0,
            "operatorName": "mean", "showThresholdColors": True, "showThresholdLabels": False,
            "thresholdMarkers": True, "thresholds": thresholds, "unitFormat": unit,
            "valueYOffset": 0, "animateNeedleValueTransition": True,
            "gaugeColor": "rgb(38, 44, 54)", "showLowerThresholdRange": True,
            "showMiddleThresholdRange": True, "showUpperThresholdRange": True,
        },
        "targets": targets(specs),
    }


def bargauge(title, x, y, w, h, specs, unit="watt", orient="horizontal", color=None, maxv=None):
    defaults = {"unit": unit, "color": {"mode": "fixed", "fixedColor": color} if color else {"mode": "continuous-GrYlRd"},
                "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]}}
    if maxv is not None:
        defaults["max"] = maxv
        defaults["min"] = 0
    return {
        "type": "bargauge", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": defaults, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "orientation": orient, "displayMode": "gradient", "showUnfilled": True, "valueMode": "color"},
        "targets": targets(specs),
    }


def piechart(title, x, y, w, h, specs, unit="watt", overrides=None):
    return {
        "type": "piechart", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {"unit": unit, "color": {"mode": "palette-classic"}}, "overrides": overrides or []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "pieType": "donut", "tooltip": {"mode": "single"},
                    "legend": {"displayMode": "table", "placement": "right", "values": ["value", "percent"]},
                    "displayLabels": ["percent"]},
        "targets": targets(specs),
    }


def state_timeline(title, x, y, w, h, specs):
    return {
        "type": "state-timeline", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {
            "custom": {"lineWidth": 0, "fillOpacity": 85}, "color": {"mode": "thresholds"},
            "mappings": [{"type": "value", "options": {
                "0": {"text": "OK", "color": C["ok"], "index": 0},
                "1": {"text": "WARNUNG", "color": C["warn"], "index": 1},
                "2": {"text": "ALARM", "color": C["crit"], "index": 2}}}],
            "thresholds": {"mode": "absolute", "steps": [
                {"color": C["ok"], "value": None}, {"color": C["warn"], "value": 1}, {"color": C["crit"], "value": 2}]}},
            "overrides": []},
        "options": {"mergeValues": True, "showValue": "auto", "alignValue": "left",
                    "rowHeight": 0.9, "legend": {"displayMode": "list", "placement": "bottom"}},
        "targets": targets(specs),
    }


def pareto(title, x, y, w, h, specs, unit="kwatth"):
    # Plugin: Pareto Chart (isaozler-paretochart-panel)
    return {
        "type": "isaozler-paretochart-panel", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {"unit": unit}, "overrides": []},
        "options": {"paretoThreshold": 80, "fieldConfig": {"colorScheme": "interpolateYlOrRd"}},
        "targets": targets(specs),
    }


def scadavis(title, x, y, w, h, specs, svg_url=""):
    # Plugin: SCADAvis Synoptic Panel (scadavis-synoptic-panel, React 2.x).
    # Bindet die Datenreihen (in Reihenfolge) an die SVG-Tags @1,@2,… bzw.
    # TAG1,TAG2,… des hochgeladenen Synoptik-SVGs. Ohne svg_url zeigt das Plugin
    # seine eingebaute Demo-Synoptik; eigenes SVG per Panel-Optionen „svgUrl"
    # (bzw. Upload) in Grafana setzen. Query-Reihenfolge: PV, Haus, Netz, Akku.
    return {
        "type": "scadavis-synoptic-panel", "title": title, "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": {"unit": "watt"}, "overrides": []},
        "options": {
            "svgUrl": svg_url, "zoomLevel": 0, "moveByX": 0, "moveByY": 0,
            "autoResize": True, "showZoomPan": False,
            "enableMousePan": False, "enableMouseWheelZoom": False,
        },
        "targets": targets(specs),
    }


panels = []
y = 0

# ── Reihe 1 · Leistungsübersicht ──────────────────────────────────────────
panels.append(row("Leistungsübersicht", y)); y += 1
flow_ovr = [
    override("/pv_power/", C["pv"], "PV"),
    override("/house_power/", C["house"], "Haus"),
    override("/grid_power/", C["pv_dc"], "Netz (+Bezug/−Einsp.)"),
    override("/battery_power/", C["battery"], "Akku"),
]
panels.append(timeseries("Leistungsfluss (W)", 0, y, 16, 9, [
    ("solar", "pv_power", {}), ("solar", "house_power", {}),
    ("solar", "grid_power", {}), ("solar", "battery_power", {})], overrides=flow_ovr))
panels.append(d3gauge("Akku-SoC", 16, y, 8, 9, [("solar", "battery_soc", {"last": True})], unit="percent", thresholds="20,50"))
y += 9
panels.append(stat("PV aktuell", 0, y, 4, 4, [("solar", "pv_power", {"last": True})], color=C["pv"]))
panels.append(stat("Netz", 4, y, 4, 4, [("solar", "grid_power", {"last": True})], color=C["pv_dc"]))
panels.append(stat("Akku", 8, y, 4, 4, [("solar", "battery_power", {"last": True})], color=C["battery"]))
panels.append(stat("Haus", 12, y, 4, 4, [("solar", "house_power", {"last": True})], color=C["house"]))
panels.append(stat("Autarkie", 16, y, 4, 4, [("solar", "autarky_pct", {"last": True})], unit="percent", color=C["ok"]))
panels.append(stat("Eigenverbrauch", 20, y, 4, 4, [("solar", "self_consumption_pct", {"last": True})], unit="percent", color=C["cyan"]))
y += 4
# Zweites Leistungsfluss-Panel als Synoptik-Mimik (SCADAvis), analog zur App.
panels.append(scadavis("Leistungsfluss · Synoptik (SCADAvis)", 0, y, 24, 9, [
    ("solar", "pv_power", {"last": True}), ("solar", "house_power", {"last": True}),
    ("solar", "grid_power", {"last": True}), ("solar", "battery_power", {"last": True})]))
y += 9

# ── Reihe 2 · Effizienz & Bilanz ──────────────────────────────────────────
panels.append(row("Effizienz & Netzbilanz", y)); y += 1
panels.append(d3gauge("Autarkie", 0, y, 6, 8, [("solar", "autarky_pct", {"last": True})], thresholds="40,70"))
panels.append(d3gauge("Eigenverbrauch", 6, y, 6, 8, [("solar", "self_consumption_pct", {"last": True})], thresholds="40,70"))
eff_ovr = [override("/autarky/", C["ok"], "Autarkie %"), override("/self_cons/", C["cyan"], "Eigenverbrauch %")]
panels.append(timeseries("Autarkie & Eigenverbrauch (Verlauf)", 12, y, 12, 8, [
    ("solar", "autarky_pct", {}), ("solar", "self_consumption_pct", {})], unit="percent", overrides=eff_ovr, fill=8))
y += 8
imp_ovr = [override("/grid_import/", C["grid_imp"], "Bezug"), override("/grid_export/", C["grid_exp"], "Einspeisung")]
panels.append(timeseries("Netz Bezug vs. Einspeisung (W)", 0, y, 12, 7, [
    ("solar", "grid_import_w", {}), ("solar", "grid_export_w", {})], overrides=imp_ovr, stack=True))
mix_ovr = [override("/pv_ac/", C["pv"], "PV AC"), override("/pv_dc/", C["pv_dc"], "PV DC"),
           override("/discharge/", C["battery"], "Akku"), override("/import/", C["grid_imp"], "Netz")]
panels.append(piechart("Hausversorgung · Mix (jetzt)", 12, y, 12, 7, [
    ("solar", "pv_ac_power", {"last": True}), ("solar", "battery_discharge_w", {"last": True}),
    ("solar", "grid_import_w", {"last": True})], overrides=mix_ovr))
y += 7

# ── Reihe 3 · Netz · Shelly Pro 3EM ───────────────────────────────────────
panels.append(row("Netz · Shelly Pro 3EM", y)); y += 1
ph_ovr = [override(f"/{p}/", PHASE[i], p) for i, p in enumerate(["L1", "L2", "L3"])]
panels.append(timeseries("Phasen-Leistung (W)", 0, y, 12, 8, [("shelly_phase", "power", {"group": "phase"})], overrides=ph_ovr))
panels.append(timeseries("Phasen-Spannung (V)", 12, y, 12, 8, [("shelly_phase", "voltage", {"group": "phase"})], unit="volt", overrides=ph_ovr, fill=4))
y += 8
panels.append(timeseries("Phasen-Strom (A)", 0, y, 12, 7, [("shelly_phase", "current", {"group": "phase"})], unit="amp", overrides=ph_ovr, fill=6))
panels.append(timeseries("Leistungsfaktor", 12, y, 12, 7, [("shelly_phase", "pf", {"group": "phase"})], unit="none", overrides=ph_ovr, fill=0))
y += 7

# ── Reihe 4 · PV · Hoymiles HM1500 (Ahoy DTU) ─────────────────────────────
panels.append(row("PV · Hoymiles HM1500 (Ahoy DTU)", y)); y += 1
ch_ovr = [override(f'/{i+1}/', CHAN[i], f"Kanal {i+1}") for i in range(4)]
panels.append(timeseries("Kanal-Leistung (W)", 0, y, 12, 8, [("hoymiles_ch", "power", {"group": "ch"})], overrides=ch_ovr))
panels.append(bargauge("Kanal-Ertrag heute (Wh)", 12, y, 8, 8, [("hoymiles_ch", "yield_day", {"group": "ch", "last": True})], unit="watth"))
panels.append(d3gauge("Power-Limit", 20, y, 4, 8, [("hoymiles", "limit_percent", {"last": True})], thresholds="50,90"))
y += 8
panels.append(timeseries("Kanal-Spannung (V)", 0, y, 12, 7, [("hoymiles_ch", "voltage", {"group": "ch"})], unit="volt", overrides=ch_ovr, fill=4))
panels.append(timeseries("Hoymiles Gesamt-AC (W)", 12, y, 12, 7, [("hoymiles", "total_power", {})], overrides=[override("/total/", C["pv"], "AC gesamt")]))
y += 7

# ── Reihe 5 · PV · Victron SmartSolar MPPT ────────────────────────────────
panels.append(row("PV · Victron SmartSolar MPPT", y)); y += 1
panels.append(timeseries("MPPT PV-Leistung (W)", 0, y, 12, 8, [("victron_mppt", "pv_power", {"group": "mppt"})], overrides=[override("/.*/", C["pv_dc"], None)]))
panels.append(timeseries("MPPT PV-Spannung (V)", 12, y, 12, 8, [("victron_mppt", "pv_voltage", {"group": "mppt"})], unit="volt", fill=4))
y += 8
panels.append(bargauge("MPPT Ertrag heute (kWh)", 0, y, 8, 7, [("victron_mppt", "yield_today", {"group": "mppt", "last": True})], unit="kwatth"))
panels.append(pareto("MPPT-Ertrag · Pareto (kWh)", 8, y, 8, 7, [("victron_mppt", "yield_today", {"group": "mppt", "last": True})], unit="kwatth"))
panels.append(timeseries("MPPT Akku-Spannung (V)", 16, y, 8, 7, [("victron_mppt", "battery_voltage", {"group": "mppt"})], unit="volt", fill=4))
y += 7

# ── Reihe 6 · Speicher · Trucki2Shelly ────────────────────────────────────
panels.append(row("Speicher · Trucki2Shelly", y)); y += 1
tr_ovr = [{"matcher": {"id": "byFrameRefID", "options": "B"}, "properties": [
    {"id": "unit", "value": "percent"}, {"id": "custom.axisPlacement", "value": "right"},
    {"id": "color", "value": {"mode": "fixed", "fixedColor": C["battery"]}}, {"id": "displayName", "value": "SoC %"}]}]
panels.append(timeseries("Akku-Spannung & SoC", 0, y, 12, 8, [
    ("trucki", "vbat", {}), ("trucki", "soc", {})], unit="volt",
    overrides=[override("/vbat/", C["violet"], "Vbat (V)")] + tr_ovr))
set_ovr = [override("/ac_power/", C["teal"], "AC-Leistung"), override("/ac_setpoint/", C["pv"], "Setpoint"),
           override("/target/", C["grid_exp"], "Target"), override("/min_power/", "#64748B", "Min"),
           override("/max_power/", "#94A3B8", "Max")]
panels.append(timeseries("Trucki Steuerung (W)", 12, y, 12, 8, [
    ("trucki", "ac_power", {}), ("trucki", "ac_setpoint", {}), ("trucki", "target", {}),
    ("trucki", "min_power", {}), ("trucki", "max_power", {})], overrides=set_ovr, fill=6))
y += 8
panels.append(stat("Ertrag heute", 0, y, 8, 4, [("trucki", "day_energy", {"last": True})], unit="kwatth", color=C["grid_exp"], decimals=2))
panels.append(stat("Ertrag gesamt", 8, y, 8, 4, [("trucki", "total_energy", {"last": True})], unit="kwatth", color=C["cyan"], decimals=1))
panels.append(stat("Temperatur", 16, y, 8, 4, [("trucki", "temperature", {"last": True})], unit="celsius",
                   thresholds=[{"color": C["ok"], "value": None}, {"color": C["warn"], "value": 45}, {"color": C["crit"], "value": 60}], graph=False))
y += 4

# ── Reihe 7 · Status · Alarme ─────────────────────────────────────────────
panels.append(row("Status · Alarme", y)); y += 1
panels.append(state_timeline("Alarm-Status (OK / Warnung / Alarm)", 0, y, 16, 7, [("alarms", "level", {})]))
panels.append(stat("Kritisch", 16, y, 4, 7, [("alarms", "critical", {"last": True})], unit="none",
                   thresholds=[{"color": C["ok"], "value": None}, {"color": C["crit"], "value": 1}], graph=False))
panels.append(stat("Warnungen", 20, y, 4, 7, [("alarms", "warning", {"last": True})], unit="none",
                   thresholds=[{"color": C["ok"], "value": None}, {"color": C["warn"], "value": 1}], graph=False))
y += 7

dashboard = {
    "annotations": {"list": []}, "editable": True, "fiscalYearStartMonth": 0,
    "graphTooltip": 1, "style": "dark",
    "tags": ["solar", "scada", "haucklab"], "timezone": "browser",
    "title": "Solar · SCADA Control Room", "uid": "solar-scada", "version": 3,
    "schemaVersion": 39, "refresh": "10s",
    "time": {"from": "now-6h", "to": "now"},
    "templating": {"list": [
        {"name": "bucket", "label": "Bucket", "type": "textbox", "query": "solar",
         "current": {"text": "solar", "value": "solar"}, "hide": 0},
        {"name": "mode", "label": "Modus", "type": "custom", "query": "live,demo",
         "options": [{"text": "live", "value": "live", "selected": True},
                     {"text": "demo", "value": "demo", "selected": False}],
         "current": {"text": "live", "value": "live"}, "hide": 0},
    ]},
    "panels": panels,
}

here = os.path.dirname(os.path.abspath(__file__))
out = json.dumps(dashboard, indent=2, ensure_ascii=False)
for path in ["provisioning/dashboards/json/solar-scada.json", "solar-scada-dashboard.json"]:
    full = os.path.join(here, path)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(out + "\n")
    print("wrote", full, "panels:", len(panels))
