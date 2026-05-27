import { useEffect, useState } from "react";
import { getLive, getToday } from "../lib/api";
import EnergyFlow from "../components/EnergyFlow";

function Card({ title, children, testid, right }) {
  return (
    <div className="border border-black bg-white" data-testid={testid}>
      <div className="border-b border-black px-4 py-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusDot({ online }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px]">
      <span className={`w-2 h-2 ${online ? "bg-green-500 dot-pulse" : "bg-red-500"}`} />
      {online ? "ONLINE" : "OFFLINE"}
    </span>
  );
}

function Metric({ label, value, unit, color = "text-black" }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">{label}</div>
      <div className={`font-mono text-2xl font-medium mt-1 ${color}`}>
        {value}
        <span className="text-xs ml-1 text-gray-600">{unit}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [live, setLive] = useState(null);
  const [today, setToday] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [l, t] = await Promise.all([getLive(), getToday()]);
        if (alive) {
          setLive(l);
          setToday(t);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e.message);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (err) {
    return (
      <div className="border border-black bg-white p-6" data-testid="dashboard-error">
        <div className="font-mono text-sm text-red-600">Fehler beim Laden: {err}</div>
      </div>
    );
  }
  if (!live) {
    return (
      <div className="font-mono text-sm text-gray-600" data-testid="dashboard-loading">
        Lade Live-Daten...
      </div>
    );
  }

  const { shelly, ahoy, trucki, victron, summary, demo_mode } = live;

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-black pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solar Dashboard</h1>
          <div className="font-mono text-xs text-gray-600 mt-1">
            {new Date(live.timestamp).toLocaleString("de-DE")}
          </div>
        </div>
        {demo_mode && (
          <div className="border border-yellow-600 bg-yellow-50 text-yellow-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]" data-testid="demo-banner">
            Demo-Modus aktiv
          </div>
        )}
      </div>

      {/* Tageswerte */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-0 border border-black bg-white" data-testid="today-stats">
        {[
          { label: "PV heute", value: today?.pv_kwh?.toFixed(2) ?? "–", unit: "kWh", color: "text-[#EAB308]" },
          { label: "Verbrauch", value: today?.consumption_kwh?.toFixed(2) ?? "–", unit: "kWh", color: "text-black" },
          { label: "Netz Bezug", value: today?.grid_import_kwh?.toFixed(2) ?? "–", unit: "kWh", color: "text-[#EF4444]" },
          { label: "Einspeisung", value: today?.grid_export_kwh?.toFixed(2) ?? "–", unit: "kWh", color: "text-[#22C55E]" },
          { label: "Autarkie", value: today?.autarky_pct?.toFixed(0) ?? "–", unit: "%", color: "text-black" },
          { label: "Eigenverbr.", value: today?.self_consumption_pct?.toFixed(0) ?? "–", unit: "%", color: "text-[#3B82F6]" },
        ].map((m, i) => (
          <div key={m.label} className={`p-4 ${i > 0 ? "border-l border-black" : ""}`}>
            <Metric label={m.label} value={m.value} unit={m.unit} color={m.color} />
          </div>
        ))}
      </div>

      {/* Energy flow + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EnergyFlow summary={summary} />
        </div>
        <div className="space-y-6">
          <Card title="Live · Zusammenfassung" testid="card-summary">
            <div className="space-y-3">
              <Metric label="PV Leistung" value={summary.pv_power.toFixed(0)} unit="W" color="text-[#EAB308]" />
              <Metric label={summary.grid_power >= 0 ? "Netz-Bezug" : "Einspeisung"} value={Math.abs(summary.grid_power).toFixed(0)} unit="W" color={summary.grid_power >= 0 ? "text-[#EF4444]" : "text-[#22C55E]"} />
              <Metric label={summary.battery_power >= 0 ? "Akku lädt" : "Akku entlädt"} value={Math.abs(summary.battery_power).toFixed(0)} unit="W" color="text-[#3B82F6]" />
              <Metric label="Hausverbrauch" value={summary.house_power.toFixed(0)} unit="W" />
            </div>
          </Card>
        </div>
      </div>

      {/* Shelly Pro 3EM 3-phase table */}
      <Card title="Shelly Pro 3EM · 3-Phasen" testid="card-shelly" right={<StatusDot online={shelly.online} />}>
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-black text-[10px] uppercase tracking-[0.2em] text-gray-600">
              <th className="text-left py-2">Phase</th>
              <th className="text-right py-2">Leistung</th>
              <th className="text-right py-2">Spannung</th>
              <th className="text-right py-2">Strom</th>
              <th className="text-right py-2">PF</th>
            </tr>
          </thead>
          <tbody>
            {shelly.phases?.map((p) => (
              <tr key={p.phase} className="border-b border-gray-200" data-testid={`shelly-${p.phase}`}>
                <td className="py-2 font-medium">{p.phase}</td>
                <td className={`py-2 text-right ${p.power >= 0 ? "text-[#EF4444]" : "text-[#22C55E]"}`}>
                  {p.power >= 0 ? "+" : ""}{p.power.toFixed(1)} W
                </td>
                <td className="py-2 text-right">{p.voltage.toFixed(1)} V</td>
                <td className="py-2 text-right">{p.current.toFixed(2)} A</td>
                <td className="py-2 text-right">{p.pf}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-2">Total</td>
              <td className={`py-2 text-right ${shelly.total_power >= 0 ? "text-[#EF4444]" : "text-[#22C55E]"}`}>
                {shelly.total_power >= 0 ? "+" : ""}{shelly.total_power?.toFixed(1)} W
              </td>
              <td colSpan="3"></td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Hoymiles channels + Trucki + Victron */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Hoymiles HM1500 · Kanäle" testid="card-ahoy" right={<StatusDot online={ahoy.online} />}>
          <div className="font-mono text-[10px] text-gray-600 mb-2">Limit: {ahoy.limit_percent}% · Total: {ahoy.total_power?.toFixed(0)} W</div>
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-black text-[10px] uppercase tracking-[0.2em] text-gray-600">
                <th className="text-left py-2">CH</th>
                <th className="text-right py-2">P</th>
                <th className="text-right py-2">U</th>
                <th className="text-right py-2">I</th>
              </tr>
            </thead>
            <tbody>
              {ahoy.channels?.map((c) => (
                <tr key={c.ch} className="border-b border-gray-200" data-testid={`ahoy-ch-${c.ch}`}>
                  <td className="py-1.5">CH{c.ch}</td>
                  <td className="py-1.5 text-right text-[#EAB308]">{c.power.toFixed(0)} W</td>
                  <td className="py-1.5 text-right">{c.voltage.toFixed(1)} V</td>
                  <td className="py-1.5 text-right">{c.current.toFixed(2)} A</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Trucki2Shelly · Speicher" testid="card-trucki" right={<StatusDot online={trucki.online} />}>
          <div className="space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">SoC</div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 h-3 border border-black relative">
                  <div className="absolute inset-y-0 left-0 bg-[#3B82F6]" style={{ width: `${trucki.soc}%` }} />
                </div>
                <div className="font-mono text-lg w-14 text-right">{trucki.soc.toFixed(0)}%</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Batterie" value={trucki.battery_voltage?.toFixed(2)} unit="V" />
              <Metric label="Leistung" value={Math.abs(trucki.battery_power).toFixed(0)} unit={`W ${trucki.battery_power >= 0 ? "↓" : "↑"}`} color="text-[#3B82F6]" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
              <div className="font-mono text-xs">AC-Output: <span className={trucki.ac_output ? "text-[#22C55E]" : "text-gray-500"}>{trucki.ac_output ? "EIN" : "AUS"}</span></div>
              <div className="font-mono text-xs">ZEPC: <span className={trucki.zepc ? "text-[#22C55E]" : "text-gray-500"}>{trucki.zepc ? "EIN" : "AUS"}</span></div>
            </div>
          </div>
        </Card>

        <Card title="Victron MPPT 150/35" testid="card-victron" right={<StatusDot online={victron.online} />}>
          <div className="space-y-3">
            {victron.mppts?.map((m) => (
              <div key={m.id} className="border-b border-gray-200 pb-2 last:border-b-0" data-testid={`victron-${m.id}`}>
                <div className="flex justify-between font-mono text-xs">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-gray-600">{m.state}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1 font-mono text-sm">
                  <div><span className="text-[#EAB308]">{m.pv_power?.toFixed(0)}</span> W</div>
                  <div>{m.pv_voltage?.toFixed(1)} V</div>
                  <div>{m.yield_today?.toFixed(2)} kWh</div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-black font-mono text-sm">
              Σ <span className="text-[#EAB308]">{victron.total_power?.toFixed(0)} W</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
