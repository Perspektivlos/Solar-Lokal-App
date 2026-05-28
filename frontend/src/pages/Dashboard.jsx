import { useEffect, useRef, useState } from "react";
import { getLive, getToday, getHistory } from "../lib/api";
import EnergyFlow from "../components/EnergyFlow";
import { Sun, Cable, BatteryCharging, Home, Activity, AlertTriangle, Radio, Wifi, WifiOff } from "lucide-react";

const COLOR = {
  pv: "#EAB308",
  grid_imp: "#EF4444",
  grid_exp: "#22C55E",
  battery: "#3B82F6",
  victron: "#10B981",
  house: "#000000",
};

// ---- helpers ----
function relativeTime(iso) {
  if (!iso) return "–";
  const dt = new Date(iso);
  const diff = (Date.now() - dt.getTime()) / 1000;
  if (diff < 2) return "gerade eben";
  if (diff < 60) return `vor ${Math.floor(diff)} s`;
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`;
  return dt.toLocaleTimeString("de-DE");
}

function formatNum(n, digits = 0) {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// ---- atomic components ----

function AccentCard({ title, accent, right, testid, children, danger }) {
  return (
    <div
      className={`bg-white border border-black ${danger ? "ring-2 ring-red-500" : ""}`}
      style={{ borderLeftWidth: 6, borderLeftColor: accent }}
      data-testid={testid}
    >
      <div className="border-b border-black px-4 py-2 flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SourceBadge({ data }) {
  let label = "DEMO";
  let cls = "border-yellow-600 bg-yellow-50 text-yellow-800";
  let Icon = Radio;
  if (data?._via_mqtt) {
    label = "MQTT LIVE";
    cls = "border-green-600 bg-green-50 text-green-800";
    Icon = Wifi;
  } else if (data?._fallback) {
    label = "FALLBACK";
    cls = "border-red-600 bg-red-50 text-red-700";
    Icon = WifiOff;
  } else if (data?.online === false) {
    label = "OFFLINE";
    cls = "border-gray-600 bg-gray-100 text-gray-700";
    Icon = WifiOff;
  } else if (data?.online === true) {
    label = "LIVE";
    cls = "border-green-600 bg-green-50 text-green-800";
    Icon = Wifi;
  }
  return (
    <span className={`inline-flex items-center gap-1 border ${cls} px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]`}>
      <Icon size={10} strokeWidth={2.5} />
      {label}
    </span>
  );
}

function Delta({ prev, curr, unit = "W" }) {
  if (prev === undefined || curr === undefined || prev === null || curr === null) return null;
  const d = curr - prev;
  if (Math.abs(d) < 0.5) return <span className="text-gray-400 font-mono text-[10px]">±0</span>;
  const up = d > 0;
  return (
    <span className={`font-mono text-[10px] ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {formatNum(Math.abs(d), 0)} {unit}
    </span>
  );
}

function Spark({ values, color = "#000", height = 28 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function MetricBig({ label, value, unit, color, sub, sparkValues, sparkColor }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600 flex items-center justify-between">
        <span>{label}</span>
        {sub}
      </div>
      <div className={`font-mono text-2xl lg:text-3xl font-medium leading-none mt-1.5 ${color || "text-black"}`}>
        {value}
        <span className="text-xs ml-1 text-gray-500">{unit}</span>
      </div>
      {sparkValues && sparkValues.length > 1 && (
        <div className="mt-2 opacity-60">
          <Spark values={sparkValues} color={sparkColor || "#9CA3AF"} height={20} />
        </div>
      )}
    </div>
  );
}

// ---- main page ----

export default function Dashboard() {
  const [live, setLive] = useState(null);
  const [today, setToday] = useState(null);
  const [trail, setTrail] = useState({ pv: [], grid: [], house: [], battery: [] });
  const [err, setErr] = useState(null);
  const prevRef = useRef(null);
  const [now, setNow] = useState(Date.now());

  // load short trail (last hour) once for sparklines
  useEffect(() => {
    let alive = true;
    getHistory("1h")
      .then((d) => {
        if (!alive) return;
        const pts = (d.points || []).slice(-30);
        setTrail({
          pv: pts.map((p) => p.pv_power),
          grid: pts.map((p) => p.grid_power),
          house: pts.map((p) => p.house_power),
          battery: pts.map((p) => p.battery_power),
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // tick clock for relative time
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // live + today poller
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [l, t] = await Promise.all([getLive(), getToday()]);
        if (!alive) return;
        prevRef.current = live;
        setLive(l);
        setToday(t);
        setTrail((tr) => ({
          pv: [...tr.pv, l.summary.pv_power].slice(-30),
          grid: [...tr.grid, l.summary.grid_power].slice(-30),
          house: [...tr.house, l.summary.house_power].slice(-30),
          battery: [...tr.battery, l.summary.battery_power].slice(-30),
        }));
        setErr(null);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line
  }, []);

  if (err) {
    return (
      <div className="border border-black border-l-[6px] border-l-red-500 bg-white p-6" data-testid="dashboard-error">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={18} />
          <span className="font-mono text-sm">Fehler beim Laden: {err}</span>
        </div>
      </div>
    );
  }
  if (!live) {
    return (
      <div className="font-mono text-sm text-gray-600 flex items-center gap-2" data-testid="dashboard-loading">
        <Activity size={14} className="animate-pulse" />
        Lade Live-Daten…
      </div>
    );
  }

  const { shelly, ahoy, trucki, victron, summary, demo_mode, timestamp } = live;
  const prev = prevRef.current;

  // SoC danger?
  const socDanger = trucki?.soc !== undefined && trucki.soc < 15;

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-black pb-3 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="w-2 h-6 bg-[#EAB308]" />
            Solar · Live
          </h1>
          <div className="font-mono text-[11px] text-gray-600 mt-1 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-green-500 dot-pulse" />
            Update: {relativeTime(timestamp)} · {new Date(timestamp).toLocaleString("de-DE")}
            <span className="text-gray-400">·</span>
            <span>Clock: {new Date(now).toLocaleTimeString("de-DE")}</span>
          </div>
        </div>
        {demo_mode && (
          <div className="border border-yellow-600 bg-yellow-50 text-yellow-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]" data-testid="demo-banner">
            ⚠ Demo-Modus aktiv · Werte werden simuliert
          </div>
        )}
      </div>

      {/* Tageswerte */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-0 border border-black bg-white" data-testid="today-stats">
        {[
          { label: "PV heute", value: formatNum(today?.pv_kwh, 2), unit: "kWh", color: "text-[#EAB308]", spark: trail.pv, sparkColor: COLOR.pv },
          { label: "Verbrauch", value: formatNum(today?.consumption_kwh, 2), unit: "kWh", color: "text-black", spark: trail.house, sparkColor: "#000" },
          { label: "Netz Bezug", value: formatNum(today?.grid_import_kwh, 2), unit: "kWh", color: "text-[#EF4444]" },
          { label: "Einspeisung", value: formatNum(today?.grid_export_kwh, 2), unit: "kWh", color: "text-[#22C55E]" },
          { label: "Autarkie", value: formatNum(today?.autarky_pct, 0), unit: "%", color: "text-black" },
          { label: "Eigenverbr.", value: formatNum(today?.self_consumption_pct, 0), unit: "%", color: "text-[#3B82F6]" },
        ].map((m, i) => (
          <div key={m.label} className={`p-4 ${i > 0 ? "border-l border-black" : ""} relative`}>
            <MetricBig
              label={m.label}
              value={m.value}
              unit={m.unit}
              color={m.color}
              sparkValues={m.spark}
              sparkColor={m.sparkColor}
            />
          </div>
        ))}
      </div>

      {/* Energy flow + summary metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EnergyFlow summary={summary} />
        </div>
        <div className="space-y-4">
          <AccentCard title="PV-Erzeugung" accent={COLOR.pv} testid="live-pv">
            <MetricBig
              label="aktuell"
              value={formatNum(summary.pv_power, 0)}
              unit="W"
              color="text-[#EAB308]"
              sub={<Delta prev={prev?.summary?.pv_power} curr={summary.pv_power} />}
              sparkValues={trail.pv}
              sparkColor={COLOR.pv}
            />
          </AccentCard>
          <AccentCard
            title={summary.grid_power >= 0 ? "Netz-Bezug" : "Einspeisung"}
            accent={summary.grid_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
            testid="live-grid"
          >
            <MetricBig
              label={summary.grid_power >= 0 ? "Import" : "Export"}
              value={formatNum(Math.abs(summary.grid_power), 0)}
              unit="W"
              color={summary.grid_power >= 0 ? "text-[#EF4444]" : "text-[#22C55E]"}
              sub={<Delta prev={prev?.summary?.grid_power} curr={summary.grid_power} />}
              sparkValues={trail.grid}
              sparkColor={summary.grid_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
            />
          </AccentCard>
          <AccentCard
            title={summary.battery_power >= 0 ? "Akku lädt" : "Akku entlädt"}
            accent={COLOR.battery}
            testid="live-battery"
            danger={socDanger}
          >
            <MetricBig
              label={summary.battery_power >= 0 ? "Ladeleistung" : "Entladeleistung"}
              value={formatNum(Math.abs(summary.battery_power), 0)}
              unit="W"
              color="text-[#3B82F6]"
              sub={<Delta prev={prev?.summary?.battery_power} curr={summary.battery_power} />}
              sparkValues={trail.battery}
              sparkColor={COLOR.battery}
            />
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600 flex items-center justify-between">
                <span>SoC</span>
                {socDanger && <span className="text-red-600 font-bold">⚠ niedrig</span>}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 h-3 border border-black relative">
                  <div className="absolute inset-y-0 left-0" style={{ width: `${summary.battery_soc}%`, backgroundColor: socDanger ? "#EF4444" : "#3B82F6" }} />
                </div>
                <div className="font-mono text-lg w-14 text-right">{formatNum(summary.battery_soc, 0)}%</div>
              </div>
            </div>
          </AccentCard>
        </div>
      </div>

      {/* Shelly 3-Phase */}
      <AccentCard
        title="Shelly Pro 3EM · 3-Phasen"
        accent={shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
        right={<SourceBadge data={shelly} />}
        testid="card-shelly"
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {shelly.phases?.map((p) => {
            const isImport = p.power >= 0;
            return (
              <div key={p.phase} className="border border-gray-200 p-3" data-testid={`shelly-${p.phase}`}>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600 flex items-center justify-between">
                  <span>Phase {p.phase}</span>
                  <Cable size={12} className={isImport ? "text-[#EF4444]" : "text-[#22C55E]"} />
                </div>
                <div className={`font-mono text-2xl font-medium mt-1 ${isImport ? "text-[#EF4444]" : "text-[#22C55E]"}`}>
                  {isImport ? "+" : ""}{formatNum(p.power, 1)}
                  <span className="text-xs ml-1 text-gray-500">W</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-[11px]">
                  <div><span className="text-gray-500">U</span><br/>{formatNum(p.voltage, 1)} V</div>
                  <div><span className="text-gray-500">I</span><br/>{formatNum(p.current, 2)} A</div>
                  <div><span className="text-gray-500">PF</span><br/>{p.pf}</div>
                </div>
              </div>
            );
          })}
          <div className="border border-black p-3 bg-gray-50">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Σ Total</div>
            <div className={`font-mono text-2xl font-medium mt-1 ${shelly.total_power >= 0 ? "text-[#EF4444]" : "text-[#22C55E]"}`}>
              {shelly.total_power >= 0 ? "+" : ""}{formatNum(shelly.total_power, 1)}
              <span className="text-xs ml-1 text-gray-500">W</span>
            </div>
            <div className="font-mono text-[10px] text-gray-500 mt-3">
              {shelly.total_power >= 0 ? "Bezug aus dem Netz" : "Einspeisung ins Netz"}
            </div>
          </div>
        </div>
      </AccentCard>

      {/* Hoymiles + Trucki + Victron */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AccentCard
          title="Hoymiles HM1500 · Kanäle"
          accent={COLOR.pv}
          right={<SourceBadge data={ahoy} />}
          testid="card-ahoy"
        >
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Total</div>
              <div className="font-mono text-xl text-[#EAB308] font-medium">{formatNum(ahoy.total_power, 0)} W</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Limit</div>
              <div className="font-mono text-xl">{ahoy.limit_percent}%</div>
            </div>
          </div>
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-black text-[10px] uppercase tracking-[0.2em] text-gray-600">
                <th className="text-left py-1">CH</th>
                <th className="text-right py-1">P</th>
                <th className="text-right py-1">U</th>
                <th className="text-right py-1">I</th>
                <th className="text-right py-1">YDay</th>
              </tr>
            </thead>
            <tbody>
              {ahoy.channels?.map((c) => (
                <tr key={c.ch} className="border-b border-gray-200" data-testid={`ahoy-ch-${c.ch}`}>
                  <td className="py-1.5">CH{c.ch}</td>
                  <td className="py-1.5 text-right text-[#EAB308]">{formatNum(c.power, 0)} W</td>
                  <td className="py-1.5 text-right">{formatNum(c.voltage, 1)} V</td>
                  <td className="py-1.5 text-right">{formatNum(c.current, 2)} A</td>
                  <td className="py-1.5 text-right">{formatNum(c.yield_day, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AccentCard>

        <AccentCard
          title="Trucki2Shelly · Speicher"
          accent={COLOR.battery}
          right={<SourceBadge data={trucki} />}
          testid="card-trucki"
          danger={trucki?.soc !== undefined && trucki.soc < 15}
        >
          <div className="space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">SoC (aus VBAT)</div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 h-3 border border-black relative">
                  <div className="absolute inset-y-0 left-0 bg-[#3B82F6]" style={{ width: `${trucki.soc}%` }} />
                </div>
                <div className="font-mono text-xl w-16 text-right">{formatNum(trucki.soc, 0)}%</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricBig label="VBAT" value={formatNum(trucki.battery_voltage, 2)} unit="V" />
              <MetricBig
                label={trucki.battery_power >= 0 ? "lädt" : "entlädt"}
                value={formatNum(Math.abs(trucki.battery_power), 0)}
                unit={`W ${trucki.battery_power >= 0 ? "↓" : "↑"}`}
                color="text-[#3B82F6]"
              />
            </div>
            {trucki.target_w !== undefined && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 font-mono text-[11px]">
                <div className="text-center"><span className="text-gray-500">TARGET</span><br/><span className="text-sm">{formatNum(trucki.target_w, 0)} W</span></div>
                <div className="text-center"><span className="text-gray-500">MIN</span><br/><span className="text-sm">{formatNum(trucki.min_power_w, 0)} W</span></div>
                <div className="text-center"><span className="text-gray-500">MAX</span><br/><span className="text-sm">{formatNum(trucki.max_power_w, 0)} W</span></div>
                <div className="text-center"><span className="text-gray-500">TAG</span><br/><span className="text-sm">{formatNum(trucki.day_energy_kwh, 2)} kWh</span></div>
                <div className="text-center"><span className="text-gray-500">GESAMT</span><br/><span className="text-sm">{formatNum(trucki.total_energy_kwh, 1)}</span></div>
                <div className="text-center"><span className="text-gray-500">TEMP</span><br/><span className="text-sm">{formatNum(trucki.temperature, 0)} °C</span></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
              <div className="font-mono text-xs">AC-Output: <span className={trucki.ac_output ? "text-[#22C55E]" : "text-gray-400"}>{trucki.ac_output ? "● EIN" : "○ AUS"}</span></div>
              <div className="font-mono text-xs">ZEPC: <span className={trucki.zepc ? "text-[#22C55E]" : "text-gray-400"}>{trucki.zepc ? "● EIN" : "○ AUS"}</span></div>
            </div>
          </div>
        </AccentCard>

        <AccentCard
          title="Victron MPPT 150/35"
          accent={COLOR.victron}
          right={<SourceBadge data={victron} />}
          testid="card-victron"
        >
          <div className="space-y-3">
            {victron.mppts?.map((m) => (
              <div key={m.id} className="border-b border-gray-200 pb-2 last:border-b-0" data-testid={`victron-${m.id}`}>
                <div className="flex justify-between font-mono text-xs">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-gray-600 uppercase tracking-wider text-[10px] border border-gray-300 px-1.5">{m.state}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1 font-mono text-xs">
                  <div><span className="text-[10px] text-gray-500">P</span><br/><span className="text-[#EAB308] text-sm">{formatNum(m.pv_power, 0)}</span> W</div>
                  <div><span className="text-[10px] text-gray-500">U</span><br/>{formatNum(m.pv_voltage, 1)} V</div>
                  <div><span className="text-[10px] text-gray-500">VBatt</span><br/>{formatNum(m.battery_voltage, 2)} V</div>
                  <div><span className="text-[10px] text-gray-500">Day</span><br/>{formatNum(m.yield_today, 2)} kWh</div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-black font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Σ Total</span>
                <span className="text-xl text-[#EAB308] font-medium">{formatNum(victron.total_power, 0)} W</span>
              </div>
            </div>
          </div>
        </AccentCard>
      </div>
    </div>
  );
}
