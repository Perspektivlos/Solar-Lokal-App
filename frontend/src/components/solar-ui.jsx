/* Einheitliche UI-Primitive für das Solar-Dashboard:
   GlassCard, Status-Badges, dominante Live-Metriken, Sparkline, Delta. */
import { Wifi, WifiOff, Radio, TriangleAlert, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";

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

const CARD_SHADOW = "0 18px 40px -22px rgba(0,0,0,0.75), 0 0 30px -20px rgba(140,146,172,0.35)";
const CARD_SHADOW_DANGER = "inset 0 0 0 1px rgba(239,68,68,0.45), 0 18px 40px -22px rgba(0,0,0,0.75), 0 0 30px -18px rgba(239,68,68,0.30)";

// Einheitliche Detailkarte: Header (Titel + Badge) · Akzentbalken · Glow · Body.
export function GlassCard({ title, accent = "#8C92AC", icon: Icon, badge, testid, children, danger, className = "" }) {
  return (
    <div
      className={`glass card-lift group relative overflow-hidden h-full flex flex-col ${className}`}
      data-testid={testid}
      style={{ boxShadow: danger ? CARD_SHADOW_DANGER : CARD_SHADOW }}
    >
      <span className="absolute top-0 left-0 right-0 h-[3px] opacity-90 pointer-events-none z-10" style={{ background: `linear-gradient(90deg, ${accent}, transparent 88%)`, boxShadow: `0 0 14px ${accent}, 0 1px 8px ${accent}aa` }} />
      <div className="absolute -top-14 -right-14 w-36 h-36 rounded-full opacity-[0.18] blur-3xl pointer-events-none transition-opacity duration-300 group-hover:opacity-30" style={{ background: accent }} />
      <div className="relative border-b border-[#8C92AC]/12 bg-gradient-to-b from-white/[0.035] to-transparent px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={13} strokeWidth={2.4} className="shrink-0 transition-colors duration-300" style={{ color: accent }} />}
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8C92AC] group-hover:text-silver transition-colors duration-300 truncate">{title}</span>
        </div>
        {badge}
      </div>
      <div className="relative p-5 flex-1">{children}</div>
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
  WARN: { cls: "border-orange-400/45 bg-orange-400/10 text-orange-300", Icon: TriangleAlert, label: "WARNUNG" },
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
      className={`inline-flex items-center gap-1 border ${b.cls} px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-[0.16em] font-semibold backdrop-blur-sm`}
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

export function Spark({ values, color = "#8C92AC", height = 24 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 100, step = w / (values.length - 1);
  const coords = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`);
  const pts = coords.join(" ");
  const gid = `sparkfill-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
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

// Sektions-Überschrift (farbiger Balken + optionales Icon + Label) als Gruppentrenner.
// Optional: `href` zeigt hinter dem Label einen Link-Button zur Geräte-Weboberfläche.
export function SectionHeader({ label, color = "#64748b", icon: Icon, href, testid }) {
  return (
    <div className="flex items-center gap-3 pt-1" data-testid={testid}>
      <span className="w-1 h-5 rounded-sm" style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />
      {Icon && <Icon size={16} strokeWidth={2.4} style={{ color }} />}
      <span className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-white/80">{label}</span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Weboberfläche öffnen (${href.replace(/^https?:\/\//, "")})`}
          data-testid={testid ? `${testid}-link` : undefined}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-[0.14em] text-white/60 hover:text-white transition-colors"
          style={{ borderColor: `${color}55`, background: `${color}14` }}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={11} strokeWidth={2.4} />
          <span>Öffnen</span>
        </a>
      )}
    </div>
  );
}
