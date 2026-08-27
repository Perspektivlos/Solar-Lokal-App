/* Einheitliche UI-Primitive für das Solar-Dashboard:
   GlassCard, Status-Badges, dominante Live-Metriken, Sparkline, Delta. */
import { Wifi, WifiOff, Radio, TriangleAlert, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export const COLOR = {
  pv: "#FACC15",
  grid_imp: "#F87171",
  grid_exp: "#10B981",
  battery: "#06B6D4",
  victron: "#34D399",
  house: "#cbd5e1",
};

export function formatNum(n, digits = 0) {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function relativeTime(iso, nowMs) {
  if (!iso) return "–";
  const dt = new Date(iso);
  const diff = (nowMs - dt.getTime()) / 1000;
  if (diff < 2) return "gerade eben";
  if (diff < 60) return `vor ${Math.floor(diff)} s`;
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`;
  return dt.toLocaleTimeString("de-DE");
}

const CARD_SHADOW = "0 12px 34px -18px rgba(0,0,0,0.6), 0 0 26px -16px rgba(226,232,240,0.22)";
const CARD_SHADOW_DANGER = "inset 0 0 0 1px rgba(239,68,68,0.45), 0 12px 34px -18px rgba(0,0,0,0.6), 0 0 26px -16px rgba(226,232,240,0.22)";

// Einheitliche Detailkarte: Header (Titel + Badge) · Akzentbalken · Glow · Body.
export function GlassCard({ title, accent = "#64748b", badge, testid, children, danger, className = "" }) {
  return (
    <div
      className={`glass relative overflow-hidden h-full flex flex-col ${className}`}
      data-testid={testid}
      style={{ borderLeft: `3px solid ${accent}`, boxShadow: danger ? CARD_SHADOW_DANGER : CARD_SHADOW }}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ background: accent }} />
      <div className="relative border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">{title}</div>
        {badge}
      </div>
      <div className="relative p-4 flex-1">{children}</div>
    </div>
  );
}

// Einheitliches Badge-System: Datenquelle (LIVE/DEMO/FALLBACK/OFFLINE) + Status
// (NORMAL/KRITISCH/LADEN/ENTLADEN) + Netzrichtung (BEZUG/EINSPEISUNG).
const BADGES = {
  MQTT: { cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300", Icon: Wifi, label: "MQTT LIVE" },
  LIVE: { cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300", Icon: Wifi, label: "LIVE" },
  DEMO: { cls: "border-amber-400/40 bg-amber-400/10 text-amber-300", Icon: Radio, label: "DEMO" },
  FALLBACK: { cls: "border-orange-400/40 bg-orange-400/10 text-orange-300", Icon: WifiOff, label: "FALLBACK" },
  OFFLINE: { cls: "border-white/20 bg-white/5 text-white/55", Icon: WifiOff, label: "OFFLINE" },
  NORMAL: { cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300", Icon: null, label: "NORMAL" },
  KRITISCH: { cls: "border-red-400/50 bg-red-400/15 text-red-300 animate-pulse", Icon: TriangleAlert, label: "KRITISCH" },
  LADEN: { cls: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300", Icon: ArrowDownToLine, label: "LÄDT" },
  ENTLADEN: { cls: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300", Icon: ArrowUpFromLine, label: "ENTLÄDT" },
  IDLE: { cls: "border-white/20 bg-white/5 text-white/55", Icon: null, label: "IDLE" },
  IMPORT: { cls: "border-red-400/40 bg-red-400/10 text-red-300", Icon: ArrowDownToLine, label: "BEZUG" },
  EXPORT: { cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300", Icon: ArrowUpFromLine, label: "EINSPEISUNG" },
};

export function Badge({ kind, label, testid }) {
  const b = BADGES[kind] || BADGES.OFFLINE;
  const Icon = b.Icon;
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1 border ${b.cls} px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-[0.16em] font-semibold`}
    >
      {Icon && <Icon size={10} strokeWidth={2.5} />}
      {label || b.label}
    </span>
  );
}

export function SourceBadge({ data, testid }) {
  let kind = "DEMO";
  if (data?._via_mqtt) kind = "MQTT";
  else if (data?._fallback) kind = "FALLBACK";
  else if (data?.online === false) kind = "OFFLINE";
  else if (data?.online === true) kind = "LIVE";
  return <Badge kind={kind} testid={testid} />;
}

export function Delta({ prev, curr }) {
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

export function Spark({ values, color = "#cbd5e1", height = 24 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 100, step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${color}aa)` }} />
    </svg>
  );
}

// Dominante Live-Metrik: große Kernzahl, kleine Einheit, optionales Vorzeichen.
export function MetricBig({ label, value, unit, color, sign, sub, sparkValues, sparkColor, size = "lg" }) {
  const valueCls = size === "sm" ? "text-2xl" : "text-3xl lg:text-4xl";
  return (
    <div>
      <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 flex items-center justify-between gap-2">
        <span>{label}</span>
        {sub}
      </div>
      <div className={`font-mono ${valueCls} font-semibold tracking-tight leading-none mt-2 ${color || "text-white"}`}>
        {sign && <span className="opacity-70">{sign}</span>}{value}
        <span className="text-lg ml-1.5 text-white/45 font-normal">{unit}</span>
      </div>
      {sparkValues && sparkValues.length > 1 && (
        <div className="mt-2.5"><Spark values={sparkValues} color={sparkColor || "#64748b"} height={22} /></div>
      )}
    </div>
  );
}

// Zurückgenommener Sekundärwert (kleiner, gedämpft) für Zusatzinfos.
export function Stat({ label, value, unit, color, testid }) {
  return (
    <div data-testid={testid}>
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</div>
      <div className={`font-mono text-lg font-medium mt-0.5 ${color || "text-white/90"}`}>
        {value}<span className="text-xs ml-1 text-white/40">{unit}</span>
      </div>
    </div>
  );
}

// Sektions-Überschrift (farbiger Balken + Label) als Gruppentrenner.
export function SectionHeader({ label, color = "#64748b", testid }) {
  return (
    <div className="flex items-center gap-2.5 pt-1" data-testid={testid}>
      <span className="w-1 h-4 rounded-sm" style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />
      <span className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">{label}</span>
    </div>
  );
}
