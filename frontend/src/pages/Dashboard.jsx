import { useEffect, useRef, useState } from "react";
import { getLive, getToday, getHistory } from "../lib/api";
import EnergyFlow from "../components/EnergyFlow";
import IntroCard from "../components/IntroCard";
import RoundTripCard from "../components/RoundTripCard";
import PhaseBalance from "../components/PhaseBalance";
import MpptCompare from "../components/MpptCompare";
import { Cable, AlertTriangle, Activity, Radio, Wifi, WifiOff } from "lucide-react";

const COLOR = {
  pv: "#FACC15",
  grid_imp: "#F87171",
  grid_exp: "#10B981",
  battery: "#06B6D4",
  victron: "#34D399",
};

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Zentraler Live-Überblick aller vier Geräte (Shelly Pro 3EM, Hoymiles via Ahoy DTU, Trucki-Speicher, 2× Victron MPPT). Zeigt aktuellen Energiefluss, 3-Phasen-Verteilung, Akku-SoC und Tageswerte.",
  },
  {
    label: "Datenquellen",
    body: "Im Demo-Modus werden Mock-Werte erzeugt. Live: MQTT-Stream wird bevorzugt; falls keine Nachrichten in 90s, fällt das Backend auf direkten HTTP-Aufruf (Shelly /rpc, Ahoy /api, Trucki /status) zurück.",
  },
  {
    label: "Aktualisierung",
    body: "Frontend pollt /api/live + /api/today alle 3 Sekunden. Sparkline-Trail enthält die letzten 30 Datenpunkte. Tageswerte aus Trapez-Integration über /api/snapshots seit Mitternacht (UTC).",
  },
  {
    label: "Tageswerte",
    body: <span>PV / Verbrauch / Bezug / Einspeisung in kWh · Autarkie (Eigenverbrauch ÷ Hausverbrauch) · Eigenverbrauchsquote (Eigenverbrauch ÷ PV). Beide auf 0–100&nbsp;% begrenzt.</span>,
  },
  {
    label: "Bekannte Einschränkungen",
    body: "Trucki-SoC wird aus VBAT linear geschätzt (LiFePO4 16S, 48 V = 0 %, 54.4 V = 100 %). Bei aktiver Last weicht der Wert vom Ruhe-SoC ab. House-Power wird rechnerisch ermittelt — kann bei Mess-Latenz kurzzeitig unrealistisch wirken.",
  },
  {
    label: "Mögliche Fehler",
    body: "‚Fehler beim Laden‘ → Backend nicht erreichbar (Service-Status prüfen). Permanenter ‚FALLBACK‘-Badge → MQTT enabled aber kein Stream + Gerät via HTTP nicht erreichbar.",
  },
];

// ---- helpers ----
function relativeTime(iso, nowMs) {
  if (!iso) return "–";
  const dt = new Date(iso);
  const diff = (nowMs - dt.getTime()) / 1000;
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

function GlassCard({ title, accent, right, testid, children, danger }) {
  return (
    <div
      className="glass relative overflow-hidden"
      data-testid={testid}
      style={{
        borderLeft: `3px solid ${accent}`,
        boxShadow: danger
          ? `inset 0 0 0 1px rgba(239,68,68,0.45), 0 12px 34px -18px rgba(0,0,0,0.6), 0 0 26px -16px rgba(226,232,240,0.22)`
          : `0 12px 34px -18px rgba(0,0,0,0.6), 0 0 26px -16px rgba(226,232,240,0.22)`,
      }}
    >
      {/* accent glow blob */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none"
           style={{ background: accent }} />
      <div className="relative border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">{title}</div>
        {right}
      </div>
      <div className="relative p-4">{children}</div>
    </div>
  );
}

function SourceBadge({ data }) {
  let label = "DEMO", cls = "border-yellow-400/40 bg-yellow-400/10 text-yellow-300", Icon = Radio;
  if (data?._via_mqtt) { label = "MQTT LIVE"; cls = "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"; Icon = Wifi; }
  else if (data?._fallback) { label = "FALLBACK"; cls = "border-red-400/40 bg-red-400/10 text-red-300"; Icon = WifiOff; }
  else if (data?.online === false) { label = "OFFLINE"; cls = "border-white/20 bg-white/5 text-white/55"; Icon = WifiOff; }
  else if (data?.online === true) { label = "LIVE"; cls = "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"; Icon = Wifi; }
  return (
    <span className={`inline-flex items-center gap-1 border ${cls} px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] rounded`}>
      <Icon size={10} strokeWidth={2.5} />
      {label}
    </span>
  );
}

function Delta({ prev, curr }) {
  if (prev === undefined || curr === undefined || prev === null || curr === null) return null;
  const d = curr - prev;
  if (Math.abs(d) < 0.5) return <span className="text-white/35 font-mono text-[10px]">±0</span>;
  const up = d > 0;
  return (
    <span className={`font-mono text-[10px] ${up ? "text-emerald-300" : "text-red-300"}`}>
      {up ? "▲" : "▼"} {formatNum(Math.abs(d), 0)} W
    </span>
  );
}

function Spark({ values, color = "#cbd5e1", height = 24 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 100, step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 3px ${color}99)` }} />
    </svg>
  );
}

function MetricBig({ label, value, unit, color, sub, sparkValues, sparkColor }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 flex items-center justify-between">
        <span>{label}</span>
        {sub}
      </div>
      <div className={`font-mono text-2xl lg:text-3xl font-medium leading-none mt-1.5 ${color || "text-white"}`}>
        {value}
        <span className="text-xs ml-1 text-white/45">{unit}</span>
      </div>
      {sparkValues && sparkValues.length > 1 && (
        <div className="mt-2"><Spark values={sparkValues} color={sparkColor || "#64748b"} height={20} /></div>
      )}
    </div>
  );
}

/**
 * Zeigt das Live-Dashboard für Solar-, Netz-, Batterie- und MPPT-Daten an.
 * @return {JSX.Element} Die Dashboard-Ansicht mit Live-Daten oder einem Lade- beziehungsweise Fehlerstatus.
 */

export default function Dashboard() {
  const [live, setLive] = useState(null);
  const [today, setToday] = useState(null);
  const [trail, setTrail] = useState({ pv: [], grid: [], house: [], battery: [] });
  const [err, setErr] = useState(null);
  const [prevLive, setPrevLive] = useState(null);
  const liveRef = useRef(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1000), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    let seeded = false;
    const tick = async () => {
      try {
        if (!seeded) {
          seeded = true;
          const h = await getHistory("1h");
          if (alive && h?.points) {
            const pts = h.points.slice(-30);
            setTrail(() => ({
              pv: pts.map((p) => p.pv_power),
              grid: pts.map((p) => p.grid_power),
              house: pts.map((p) => p.house_power),
              battery: pts.map((p) => p.battery_power),
            }));
          }
        }
        const [l, t] = await Promise.all([getLive(), getToday()]);
        if (!alive) return;
        setPrevLive(liveRef.current);
        liveRef.current = l;
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
  }, []);

  if (err) {
    return (
      <div className="space-y-6">
        <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent="#FACC15" testid="intro-dashboard" />
        <div className="glass-strong p-6" style={{ borderLeft: "3px solid #F87171" }} data-testid="dashboard-error">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle size={18} />
            <span className="font-mono text-sm">Fehler beim Laden: {err}</span>
          </div>
        </div>
      </div>
    );
  }
  if (!live) {
    return (
      <div className="space-y-6">
        <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent="#FACC15" testid="intro-dashboard" />
        <div className="font-mono text-sm text-white/55 flex items-center gap-2" data-testid="dashboard-loading">
          <Activity size={14} className="animate-pulse" />
          Lade Live-Daten…
        </div>
      </div>
    );
  }

  const { shelly, ahoy, trucki, victron, summary, demo_mode, timestamp } = live;
  const prev = prevLive;
  const socDanger = trucki?.soc !== undefined && trucki.soc < 15;

  return (
    <div className="space-y-6" data-testid="dashboard">
      <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent="#FACC15" testid="intro-dashboard" />

      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
            <span className="w-1.5 h-7 rounded-sm" style={{ background: COLOR.pv, boxShadow: `0 0 10px ${COLOR.pv}aa` }} />
            Solar · Live
          </h1>
          <div className="font-mono text-[11px] text-white/55 mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse text-emerald-400" />
            Update: {relativeTime(timestamp, now)}
            <span className="text-white/30">·</span>
            <span>Clock: {new Date(now).toLocaleTimeString("de-DE")}</span>
          </div>
        </div>
        {demo_mode && (
          <div className="border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] rounded" data-testid="demo-banner">
            ⚠ Demo-Modus aktiv · Werte werden simuliert
          </div>
        )}
      </div>

      {/* Tageswerte – ein Raster in abgesteckte Bereiche */}
      <div className="glass overflow-hidden grid grid-cols-2 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-white/[0.07]" data-testid="today-stats">
        {[
          { label: "PV heute", value: formatNum(today?.pv_kwh, 2), unit: "kWh", color: "text-yellow-300 neon-text-yellow", accent: COLOR.pv, spark: trail.pv, sparkColor: COLOR.pv },
          { label: "Verbrauch", value: formatNum(today?.consumption_kwh, 2), unit: "kWh", color: "text-white", accent: "#cbd5e1", spark: trail.house, sparkColor: "#cbd5e1" },
          { label: "Netz Bezug", value: formatNum(today?.grid_import_kwh, 2), unit: "kWh", color: "text-red-300 neon-text-red", accent: COLOR.grid_imp },
          { label: "Einspeisung", value: formatNum(today?.grid_export_kwh, 2), unit: "kWh", color: "text-emerald-300 neon-text-green", accent: COLOR.grid_exp },
          { label: "Autarkie", value: formatNum(today?.autarky_pct, 0), unit: "%", color: "text-violet-300", accent: "#A78BFA" },
          { label: "Eigenverbr.", value: formatNum(today?.self_consumption_pct, 0), unit: "%", color: "text-cyan-300 neon-text-cyan", accent: COLOR.battery },
        ].map((m) => (
          <div
            key={m.label}
            className="relative p-4 transition-colors hover:bg-white/[0.02]"
            data-testid={`today-stat-${m.label}`}
          >
            <span
              className="absolute top-0 left-0 right-0 h-[2px] opacity-80 pointer-events-none"
              style={{ background: `linear-gradient(90deg, ${m.accent}, transparent 88%)` }}
            />
            <MetricBig label={m.label} value={m.value} unit={m.unit} color={m.color} sparkValues={m.spark} sparkColor={m.sparkColor} />
          </div>
        ))}
      </div>

      {/* Energy flow + summary metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><EnergyFlow summary={summary} trucki={trucki} /></div>
        <div className="space-y-4">
          <GlassCard title="PV-Erzeugung" accent={COLOR.pv} testid="live-pv">
            <MetricBig label="aktuell" value={formatNum(summary.pv_power, 0)} unit="W"
              color="text-yellow-300 neon-text-yellow"
              sub={<Delta prev={prev?.summary?.pv_power} curr={summary.pv_power} />}
              sparkValues={trail.pv} sparkColor={COLOR.pv} />
          </GlassCard>
          <GlassCard
            title={summary.grid_power >= 0 ? "Netz-Bezug" : "Einspeisung"}
            accent={summary.grid_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
            testid="live-grid">
            <MetricBig
              label={summary.grid_power >= 0 ? "Import" : "Export"}
              value={formatNum(Math.abs(summary.grid_power), 0)} unit="W"
              color={summary.grid_power >= 0 ? "text-red-300 neon-text-red" : "text-emerald-300 neon-text-green"}
              sub={<Delta prev={prev?.summary?.grid_power} curr={summary.grid_power} />}
              sparkValues={trail.grid}
              sparkColor={summary.grid_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
            />
          </GlassCard>
        </div>
      </div>

      {/* Shelly 3-Phase */}
      <GlassCard
        title="Shelly Pro 3EM · 3-Phasen-Energiemesser"
        accent={shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
        right={<SourceBadge data={shelly} />}
        testid="card-shelly"
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {shelly.phases?.map((p) => {
            const isImport = p.power >= 0;
            return (
              <div key={p.phase} className="glass-inset p-3" data-testid={`shelly-${p.phase}`}>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 flex items-center justify-between">
                  <span>Phase {p.phase}</span>
                  <Cable size={12} className={isImport ? "text-red-300" : "text-emerald-300"} />
                </div>
                <div className={`font-mono text-2xl font-medium mt-1 ${isImport ? "text-red-300 neon-text-red" : "text-emerald-300 neon-text-green"}`}>
                  {isImport ? "+" : ""}{formatNum(p.power, 1)}<span className="text-xs ml-1 text-white/45">W</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-[11px] text-white/80">
                  <div><span className="text-white/45">U</span><br/>{formatNum(p.voltage, 1)} V</div>
                  <div><span className="text-white/45">I</span><br/>{formatNum(p.current, 2)} A</div>
                  <div><span className="text-white/45">PF</span><br/>{p.pf}</div>
                </div>
              </div>
            );
          })}
          <div className="glass-inset p-3" style={{ borderLeft: `3px solid ${shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}` }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Σ Total</div>
            <div className={`font-mono text-2xl font-medium mt-1 ${shelly.total_power >= 0 ? "text-red-300 neon-text-red" : "text-emerald-300 neon-text-green"}`}>
              {shelly.total_power >= 0 ? "+" : ""}{formatNum(shelly.total_power, 1)}
              <span className="text-xs ml-1 text-white/45">W</span>
            </div>
            <div className="font-mono text-[10px] text-white/50 mt-3">
              {shelly.total_power >= 0 ? "Bezug aus dem Netz" : "Einspeisung ins Netz"}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Netz-Phasen & PV-AC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PhaseBalance phases={shelly.phases} />
        <GlassCard title="Hoymiles HM1500 · Kanäle" accent={COLOR.pv} right={<SourceBadge data={ahoy} />} testid="card-ahoy">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Total</div>
              <div className="font-mono text-xl text-yellow-300 neon-text-yellow font-medium">{formatNum(ahoy.total_power, 0)} W</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Limit</div>
              <div className="font-mono text-xl text-white">{ahoy.limit_percent}%</div>
            </div>
          </div>
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.22em] text-white/55">
                <th className="text-left py-1">CH</th><th className="text-right py-1">P</th><th className="text-right py-1">U</th>
                <th className="text-right py-1">I</th><th className="text-right py-1">YDay</th>
              </tr>
            </thead>
            <tbody>
              {ahoy.channels?.map((c) => (
                <tr key={c.ch} className="border-b border-white/5 text-white/85" data-testid={`ahoy-ch-${c.ch}`}>
                  <td className="py-1.5">CH{c.ch}</td>
                  <td className="py-1.5 text-right text-yellow-300">{formatNum(c.power, 0)} W</td>
                  <td className="py-1.5 text-right">{formatNum(c.voltage, 1)} V</td>
                  <td className="py-1.5 text-right">{formatNum(c.current, 2)} A</td>
                  <td className="py-1.5 text-right">{formatNum(c.yield_day, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>

      {/* Akku-Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="battery-row">
        <GlassCard title={summary.battery_power >= 0 ? "Akku lädt (netto)" : "Akku entlädt (netto)"} accent={COLOR.battery} testid="live-battery" danger={socDanger}>
          <MetricBig
            label={summary.battery_power >= 0 ? "Ladeleistung netto" : "Entladeleistung netto"}
            value={formatNum(Math.abs(summary.battery_power), 0)} unit="W"
            color="text-cyan-300 neon-text-cyan"
            sub={<Delta prev={prev?.summary?.battery_power} curr={summary.battery_power} />}
            sparkValues={trail.battery} sparkColor={COLOR.battery}
          />
          <div className="grid grid-cols-2 gap-2 mt-3" data-testid="battery-breakdown">
            <div className="glass-inset p-2" style={{ borderLeft: "3px solid #FACC15" }}>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">Laden · MPPT</div>
              <div className="font-mono text-base text-yellow-300" data-testid="battery-charge">{formatNum(summary.battery_charge_w, 0)}<span className="text-[10px] text-white/40"> W</span></div>
            </div>
            <div className="glass-inset p-2" style={{ borderLeft: "3px solid #06B6D4" }}>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">Entladen · SUN</div>
              <div className="font-mono text-base text-cyan-300" data-testid="battery-discharge">{formatNum(summary.battery_discharge_w, 0)}<span className="text-[10px] text-white/40"> W</span></div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 flex items-center justify-between">
              <span>SoC</span>
              {socDanger && <span className="text-red-300 font-bold">⚠ niedrig</span>}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-3 rounded glass-inset relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 transition-all" style={{
                  width: `${summary.battery_soc}%`,
                  background: socDanger ? "linear-gradient(90deg, #DC2626, #F87171)" : "linear-gradient(90deg, #0891b2, #06B6D4)",
                  boxShadow: `0 0 12px ${socDanger ? "#F87171" : COLOR.battery}88`,
                }} />
              </div>
              <div className="font-mono text-lg w-14 text-right text-white">{formatNum(summary.battery_soc, 0)}%</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Trucki2Shelly · Speicher" accent={COLOR.battery} right={<SourceBadge data={trucki} />} testid="card-trucki" danger={trucki?.soc !== undefined && trucki.soc < 15}>
          <div className="space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">SoC (aus VBAT)</div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 h-3 glass-inset relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0" style={{
                    width: `${trucki.soc}%`,
                    background: "linear-gradient(90deg, #0891b2, #06B6D4)",
                    boxShadow: `0 0 10px ${COLOR.battery}88`,
                  }} />
                </div>
                <div className="font-mono text-xl w-16 text-right text-white">{formatNum(trucki.soc, 0)}%</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricBig label="VBAT" value={formatNum(trucki.battery_voltage, 2)} unit="V" />
              <MetricBig label={trucki.battery_power >= 0 ? "lädt" : "entlädt"} value={formatNum(Math.abs(trucki.battery_power), 0)} unit={`W ${trucki.battery_power >= 0 ? "↓" : "↑"}`} color="text-cyan-300 neon-text-cyan" />
            </div>
            {trucki.target_w !== undefined && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 font-mono text-[11px]">
                <div className="text-center text-white/85"><span className="text-white/45">TARGET</span><br/><span className="text-sm">{formatNum(trucki.target_w, 0)} W</span></div>
                <div className="text-center text-white/85"><span className="text-white/45">MIN</span><br/><span className="text-sm">{formatNum(trucki.min_power_w, 0)} W</span></div>
                <div className="text-center text-white/85"><span className="text-white/45">MAX</span><br/><span className="text-sm">{formatNum(trucki.max_power_w, 0)} W</span></div>
                <div className="text-center text-white/85"><span className="text-white/45">TAG</span><br/><span className="text-sm">{formatNum(trucki.day_energy_kwh, 2)} kWh</span></div>
                <div className="text-center text-white/85"><span className="text-white/45">GESAMT</span><br/><span className="text-sm">{formatNum(trucki.total_energy_kwh, 1)}</span></div>
                <div className="text-center text-white/85"><span className="text-white/45">TEMP</span><br/><span className="text-sm">{formatNum(trucki.temperature, 0)} °C</span></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
              <div className="font-mono text-xs text-white/65">AC-Output: <span className={trucki.ac_output ? "text-emerald-300" : "text-white/30"}>{trucki.ac_output ? "● EIN" : "○ AUS"}</span></div>
              <div className="font-mono text-xs text-white/65">ZEPC: <span className={trucki.zepc ? "text-emerald-300" : "text-white/30"}>{trucki.zepc ? "● EIN" : "○ AUS"}</span></div>
            </div>
          </div>
        </GlassCard>

        <RoundTripCard today={today} />
      </div>

      {/* MPPT-Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="mppt-row">
        <GlassCard title="Victron MPPT 150/35" accent={COLOR.victron} right={<SourceBadge data={victron} />} testid="card-victron">
          <div className="space-y-3">
            {victron.mppts?.map((m) => (
              <div key={m.id} className="border-b border-white/10 pb-2 last:border-b-0" data-testid={`victron-${m.id}`}>
                <div className="flex justify-between font-mono text-xs text-white/85">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-white/60 uppercase tracking-wider text-[10px] border border-white/15 px-1.5 rounded">{m.state}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1 font-mono text-xs text-white/80">
                  <div><span className="text-[10px] text-white/45">P</span><br/><span className="text-yellow-300 text-sm">{formatNum(m.pv_power, 0)}</span> W</div>
                  <div><span className="text-[10px] text-white/45">U</span><br/>{formatNum(m.pv_voltage, 1)} V</div>
                  <div><span className="text-[10px] text-white/45">VBatt</span><br/>{formatNum(m.battery_voltage, 2)} V</div>
                  <div><span className="text-[10px] text-white/45">Day</span><br/>{formatNum(m.yield_today, 2)} kWh</div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-white/10 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/55">Σ Total</span>
                <span className="text-xl text-yellow-300 neon-text-yellow font-medium">{formatNum(victron.total_power, 0)} W</span>
              </div>
            </div>
          </div>
        </GlassCard>

        <MpptCompare mppts={victron.mppts} />
      </div>
    </div>
  );
}
