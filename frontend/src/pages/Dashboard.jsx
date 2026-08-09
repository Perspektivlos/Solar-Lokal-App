import { useEffect, useRef, useState } from "react";
import { getLive, getToday, getHistory } from "../lib/api";
import EnergyFlow from "../components/EnergyFlow";
import IntroCard from "../components/IntroCard";
import RoundTripCard from "../components/RoundTripCard";
import PhaseBalance from "../components/PhaseBalance";
import MpptCompare from "../components/MpptCompare";
import DeviceTile from "../components/DeviceTile";
import { Cable, AlertTriangle, Activity, Radio, Wifi, WifiOff, Sun, Home, BatteryCharging, Cpu } from "lucide-react";

const COLOR = {
  pv: "#FACC15",
  grid_imp: "#F87171",
  grid_exp: "#10B981",
  battery: "#06B6D4",
  victron: "#34D399",
  silver: "#cbd5e1",
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
  if (Math.abs(d) < 0.5) return <span className="text-silver-dim font-mono text-[10px]">±0</span>;
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

function MetricInline({ label, value, unit, color, sparkValues, sparkColor }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="tile-stat text-[9px] truncate">{label}</div>
      <div className={`tile-value text-lg leading-tight ${color || "text-white"}`}>
        {value}
        <span className="text-silver-dim text-[10px] ml-0.5">{unit}</span>
      </div>
      {sparkValues && sparkValues.length > 1 && (
        <div className="mt-1"><Spark values={sparkValues} color={sparkColor || "#64748b"} height={16} /></div>
      )}
    </div>
  );
}

/**
 * Kommandoraum-Dashboard: Tageswerte im Header nebeneinander, großer Energiefluss,
 * gleich große Geräte-Kacheln (Silber/Schwarz/Grau Command-Center-Stil).
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
        <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent={COLOR.pv} testid="intro-dashboard" />
        <div className="glass-steel p-6 border-l-[3px] border-l-red-400" data-testid="dashboard-error">
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
        <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent={COLOR.pv} testid="intro-dashboard" />
        <div className="font-mono text-sm text-silver-dim flex items-center gap-2" data-testid="dashboard-loading">
          <Activity size={14} className="animate-pulse" />
          Lade Live-Daten…
        </div>
      </div>
    );
  }

  const { shelly, ahoy, trucki, victron, summary, demo_mode, timestamp } = live;
  const prev = prevLive;
  const socDanger = trucki?.soc !== undefined && trucki.soc < 15;

  // Netz-Status für dynamische Farbe (Bezug = rot, Einspeisung = grün)
  const gridImporting = (summary?.grid_power ?? 0) >= 0;
  const netzAktuellColor = gridImporting ? "text-red-300" : "text-emerald-300";
  const netzAktuellAccent = gridImporting ? COLOR.grid_imp : COLOR.grid_exp;
  const netzAktuellSpark = gridImporting ? COLOR.grid_imp : COLOR.grid_exp;

  // Tageswert-Kacheln für den Header (nebeneinander): erst PV, dann Netz
  const headerStats = [
    // --- PV ---
    { label: "PV Gesamt", value: formatNum(today?.pv_kwh, 2), unit: "kWh", color: "text-yellow-300", accent: COLOR.pv, spark: trail.pv, sparkColor: COLOR.pv, testid: "today-stat-PV Gesamt" },
    { label: "PV Aktuell", value: formatNum(summary?.pv_power, 0), unit: "W", color: "text-yellow-200", accent: COLOR.pv, spark: trail.pv, sparkColor: COLOR.pv, testid: "today-stat-PV Aktuell" },
    // --- Netz ---
    { label: "Netz Bezug (Gesamt)", value: formatNum(today?.grid_import_kwh, 2), unit: "kWh", color: "text-red-300", accent: COLOR.grid_imp, spark: trail.grid, sparkColor: COLOR.grid_imp, testid: "today-stat-Netz Bezug" },
    { label: gridImporting ? "Netz Bezug (Aktuell)" : "Netz Einspeisung (Aktuell)", value: formatNum(Math.abs(summary?.grid_power ?? 0), 0), unit: "W", color: netzAktuellColor, accent: netzAktuellAccent, spark: trail.grid, sparkColor: netzAktuellSpark, testid: "today-stat-Netz Aktuell" },
    { label: "Verbrauch (Gesamt)", value: formatNum(today?.consumption_kwh, 2), unit: "kWh", color: "text-white", accent: COLOR.silver, spark: trail.house, sparkColor: COLOR.silver, testid: "today-stat-Verbrauch" },
    { label: "Einspeisung (Gesamt)", value: formatNum(today?.grid_export_kwh, 2), unit: "kWh", color: "text-emerald-300", accent: COLOR.grid_exp, spark: null, testid: "today-stat-Einspeisung" },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard">
      <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent={COLOR.pv} testid="intro-dashboard" />

      {/* ===== HEADER: Titel + Tageswerte nebeneinander ===== */}
      <div className="glass-steel overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-7 rounded-sm" style={{ background: COLOR.pv, boxShadow: `0 0 10px ${COLOR.pv}aa` }} />
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
                Solar · Live
              </h1>
              <div className="font-mono text-[11px] text-silver-dim mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse" />
                Update: {relativeTime(timestamp, now)}
                <span className="text-silver-dim/60">·</span>
                <span>{new Date(now).toLocaleTimeString("de-DE")}</span>
              </div>
            </div>
          </div>
          {demo_mode && (
            <div className="border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] rounded" data-testid="demo-banner">
              ⚠ Demo-Modus aktiv
            </div>
          )}
        </div>
        <div className="silver-divider" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-white/[0.06]" data-testid="today-stats">
          {headerStats.map((m) => (
            <div key={m.label} className="relative p-3 transition-colors hover:bg-white/[0.02]" data-testid={m.testid}>
              <span className="absolute top-0 left-0 right-0 h-[2px] opacity-80 pointer-events-none"
                    style={{ background: `linear-gradient(90deg, ${m.accent}, transparent 88%)` }} />
              <MetricInline label={m.label} value={m.value} unit={m.unit} color={m.color} sparkValues={m.spark} sparkColor={m.sparkColor} />
            </div>
          ))}
        </div>
      </div>

      {/* ===== ENERGIE FLUSS (prominent, tiefschwarz) ===== */}
      <div className="glass-carbon overflow-hidden" data-testid="energy-flow-card">
        <EnergyFlow summary={summary} trucki={trucki} />
      </div>

      {/* ===== GERÄTE-GRUPPEN: gestapelte Reihen, Kacheln proportional zum Inhalt ===== */}
      <div className="space-y-5" data-testid="device-groups">

        {/* --- Reihe 1: Batterie --- */}
        <div data-testid="group-battery">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-1.5 h-4 rounded-sm" style={{ background: COLOR.battery, boxShadow: `0 0 8px ${COLOR.battery}aa` }} />
            <span className="tile-stat text-[11px]" style={{ color: "rgba(241,245,249,0.7)" }}>Batterie</span>
          </div>
          <div className="flex gap-5 flex-wrap">
            <DeviceTile
              title="Trucki2Shelly"
              accent={COLOR.battery}
              icon={BatteryCharging}
              badge={<SourceBadge data={trucki} />}
              weight={3}
              hero={{
                value: `${formatNum(trucki.soc, 0)}%`,
                unit: `SoC`,
                sub: `VBAT ${formatNum(trucki.battery_voltage, 2)} V`,
                color: socDanger ? "text-red-300" : "text-cyan-300",
              }}
              rows={[
                { label: "VBAT", value: `${formatNum(trucki.battery_voltage, 2)} V`, color: "rgba(241,245,249,0.9)" },
                { label: trucki.battery_power >= 0 ? "Lädt" : "Entlädt", value: `${formatNum(Math.abs(trucki.battery_power), 0)} W`, color: "text-cyan-300" },
                { label: "TARGET / MIN / MAX", value: `${formatNum(trucki.target_w, 0)} / ${formatNum(trucki.min_w, 0)} / ${formatNum(trucki.max_w, 0)} W`, color: "rgba(241,245,249,0.8)" },
                { label: "TAG (Durchsatz)", value: `${formatNum(trucki.throughput_day, 2)} kWh`, color: "rgba(241,245,249,0.8)" },
                { label: "GESAMT", value: `${formatNum(trucki.total_kwh, 1)} kWh`, color: "rgba(241,245,249,0.8)" },
                { label: "TEMP", value: `${formatNum(trucki.temperature, 1)} °C`, color: "rgba(241,245,249,0.85)" },
                { label: "AC-Out", value: trucki.ac_output ? "EIN" : "AUS", color: trucki.ac_output ? "text-emerald-300" : "text-silver-dim" },
                { label: "ZEPC", value: trucki.zepc ? "EIN" : "AUS", color: trucki.zepc ? "text-emerald-300" : "text-silver-dim" },
              ].filter((r) => r.value !== "null" && r.value !== "NaN" && !r.value.includes("NaN"))}
              testid="card-trucki"
            />
            <DeviceTile
              title={summary.battery_power >= 0 ? "Akku lädt (netto)" : "Akku entlädt (netto)"}
              accent={COLOR.battery}
              icon={BatteryCharging}
              weight={2}
              hero={{
                value: formatNum(Math.abs(summary.battery_power), 0),
                unit: "W",
                sub: `${formatNum(summary.battery_soc, 0)}% SoC`,
                color: socDanger ? "text-red-300" : "text-cyan-300",
              }}
              rows={[
                { label: "Laden · MPPT", value: `${formatNum(summary.battery_charge_w, 0)} W`, color: "text-yellow-300" },
                { label: "Entl. · SUN", value: `${formatNum(summary.battery_discharge_w, 0)} W`, color: "text-cyan-300" },
              ]}
              testid="live-battery"
            />
            <div className="device-tile glass-steel !flex" data-testid="card-roundtrip-wrapper" style={{ flexGrow: 2, flexBasis: 0, minWidth: 0, justifyContent: "center" }}>
              <RoundTripCard today={today} />
            </div>
          </div>
        </div>

        {/* --- Reihe 2: Victron --- */}
        <div data-testid="group-victron">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-1.5 h-4 rounded-sm" style={{ background: COLOR.victron, boxShadow: `0 0 8px ${COLOR.victron}aa` }} />
            <span className="tile-stat text-[11px]" style={{ color: "rgba(241,245,249,0.7)" }}>Victron</span>
          </div>
          <div className="flex gap-5 flex-wrap">
            <DeviceTile
              title="Victron MPPT"
              accent={COLOR.victron}
              icon={Cpu}
              badge={<SourceBadge data={victron} />}
              weight={2}
              hero={{ value: formatNum(victron.total_power, 0), unit: "W", sub: `${victron.mppts?.length || 0} Laderegler`, color: "text-yellow-300" }}
              rows={(victron.mppts || []).slice(0, 4).flatMap((m) => ([
                { label: `#${m.id} ${m.state || ""}`.trim(), value: `${formatNum(m.pv_power, 0)}W`, color: "text-yellow-300" },
                { label: `  U ${formatNum(m.pv_voltage, 1)}V · VBatt ${formatNum(m.battery_voltage, 2)}V`, value: `${formatNum(m.yield_today, 2)} kWh/Tag`, color: "rgba(241,245,249,0.8)" },
              ]))}
              testid="card-victron"
            />
            <div className="device-tile glass-steel !flex" data-testid="card-mppt-compare-wrapper" style={{ flexGrow: 3, flexBasis: 0, minWidth: 0, justifyContent: "center" }}>
              <MpptCompare mppts={victron.mppts} />
            </div>
          </div>
        </div>

        {/* --- Reihe 3: PV & Netz (Rest) --- */}
        <div data-testid="group-rest">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-1.5 h-4 rounded-sm" style={{ background: COLOR.pv, boxShadow: `0 0 8px ${COLOR.pv}aa` }} />
            <span className="tile-stat text-[11px]" style={{ color: "rgba(241,245,249,0.7)" }}>PV &amp; Netz</span>
          </div>
          <div className="flex gap-5 flex-wrap">
            <DeviceTile
              title="Hoymiles HM1500"
              accent={COLOR.pv}
              icon={Sun}
              badge={<SourceBadge data={ahoy} />}
              weight={3}
              hero={{ value: formatNum(ahoy.total_power, 0), unit: "W", sub: `Limit ${ahoy.limit_percent}%`, color: "text-yellow-300" }}
              rows={ahoy.channels?.slice(0, 4).map((c) => ({
                label: `CH${c.ch} P ${formatNum(c.power, 0)}W · U ${formatNum(c.voltage, 1)}V · I ${formatNum(c.current, 2)}A`,
                value: `${formatNum(c.yield_day, 2)} kWh (YDAY)`,
                color: "rgba(241,245,249,0.9)",
              })) || []}
              testid="card-ahoy"
            />
            <div className="device-tile glass-steel !flex" data-testid="live-grid" style={{ flexGrow: 2, flexBasis: 0, minWidth: 0, justifyContent: "center" }}>
              <div className="p-4 w-full">
                <div className="tile-stat text-[10px]">{summary.grid_power >= 0 ? "Netz-Bezug (Import)" : "Einspeisung (Export)"}</div>
                <div className={`tile-value text-3xl mt-1 ${summary.grid_power >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                  {formatNum(Math.abs(summary.grid_power), 0)}<span className="text-silver-dim text-xs ml-1">W</span>
                </div>
                <div className="mt-2"><Spark values={trail.grid} color={summary.grid_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp} height={20} /></div>
                <div className="tile-stat text-[10px] mt-3">Hausverbrauch aktuell</div>
                <div className="tile-value text-xl text-white mt-0.5">
                  {formatNum(summary.house_power, 0)}<span className="text-silver-dim text-xs ml-1">W</span>
                </div>
                <div className="mt-2"><Spark values={trail.house} color={COLOR.silver} height={20} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Reihe 4: Shelly --- */}
        <div data-testid="group-shelly">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="w-1.5 h-4 rounded-sm" style={{ background: shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp, boxShadow: `0 0 8px ${shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}aa` }} />
            <span className="tile-stat text-[11px]" style={{ color: "rgba(241,245,249,0.7)" }}>Shelly</span>
          </div>
          <div className="flex gap-5 flex-wrap">
            <DeviceTile
              title="Shelly Pro 3EM"
              accent={shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
              icon={Cable}
              badge={<SourceBadge data={shelly} />}
              weight={3}
              hero={{
                value: `${shelly.total_power >= 0 ? "+" : ""}${formatNum(shelly.total_power, 1)}`,
                unit: "W",
                sub: shelly.total_power >= 0 ? "Bezug aus dem Netz" : "Einspeisung ins Netz",
                color: shelly.total_power >= 0 ? "text-red-300" : "text-emerald-300",
              }}
              rows={shelly.phases?.map((p) => ({
                label: `${p.phase} ${p.power >= 0 ? "+" : ""}${formatNum(p.power, 0)}W`,
                value: `${formatNum(p.voltage, 0)}V · ${formatNum(p.current, 1)}A`,
                color: "rgba(241,245,249,0.85)",
              })) || []}
              testid="card-shelly"
            />
            <div className="device-tile glass-steel !flex" data-testid="card-phase-wrapper" style={{ flexGrow: 2, flexBasis: 0, minWidth: 0, justifyContent: "center" }}>
              <PhaseBalance phases={shelly.phases} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
