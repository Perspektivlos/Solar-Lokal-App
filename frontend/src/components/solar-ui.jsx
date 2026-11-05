/* Einheitliche UI-Primitive für das Solar-Dashboard:
   GlassCard, Status-Badges, dominante Live-Metriken, Sparkline, Delta. */
import { useState } from "react";
import { Wifi, WifiOff, Radio, TriangleAlert, ArrowDownToLine, ArrowUpFromLine, ExternalLink, ChevronDown, BookOpen, Star } from "lucide-react";

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

// Einheitliche Detailkarte im Stil der Geräte-Karten: dunkler Verlauf, Akzent-Rahmen + Oberkante, Icon-Box.
const cardShadow = (c) => `inset 0 1px 0 rgba(226,232,240,0.05), 0 18px 44px -26px #000, 0 0 26px -14px ${c}`;

export function GlassCard({ title, accent = "#8C92AC", icon: Icon, badge, testid, children, danger, className = "" }) {
  const edge = danger ? "#EF4444" : accent;
  return (
    <div
      className={`card-lift relative rounded-xl overflow-hidden h-full flex flex-col ${className}`}
      data-testid={testid}
      style={{ background: "linear-gradient(150deg, #0d1626 0%, #070c18 100%)", border: `1px solid ${edge}${danger ? "88" : "3a"}`, boxShadow: cardShadow(edge) }}
    >
      <span className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none z-10" style={{ background: `linear-gradient(90deg, ${accent}, transparent 85%)`, boxShadow: `0 0 12px ${accent}` }} />
      <div className="relative border-b border-white/[0.06] px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span className="grid place-items-center rounded-md shrink-0" style={{ width: 26, height: 26, background: `${accent}1f`, border: `1px solid ${accent}55` }}>
              <Icon size={14} color={accent} />
            </span>
          )}
          <span className="font-sans text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.12em] sm:tracking-[0.16em] text-white/85 truncate">{title}</span>
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
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
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
// Optional: `href` = Link-Button zur Geräte-Weboberfläche · `details` = aufklappbares
// Info-Panel (gleiches Prinzip wie die IntroCard oben), gefiltert auf das Rubrik-Gerät.
export function SectionHeader({ label, color = "#64748b", icon: Icon, href, details, alarms, testid, pinned, onPin }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Array.isArray(details) && details.length > 0;
  const alarmList = Array.isArray(alarms) ? alarms : [];
  const hasCritical = alarmList.some((a) => a.severity === "critical");
  return (
    <div data-testid={testid}>
      <div className="relative rounded-xl overflow-hidden flex flex-wrap items-center gap-3 px-4 py-2.5"
        style={{ background: "linear-gradient(150deg, #0d1626 0%, #070c18 100%)", border: `1px solid ${color}3a`, boxShadow: `inset 0 1px 0 rgba(226,232,240,0.05), 0 14px 34px -24px #000, 0 0 22px -14px ${color}` }}>
        <span className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${color}, transparent 70%)`, boxShadow: `0 0 10px ${color}` }} />
        {Icon && (
          <span className="grid place-items-center rounded-md shrink-0" style={{ width: 26, height: 26, background: `${color}1f`, border: `1px solid ${color}55` }}>
            <Icon size={14} strokeWidth={2.4} color={color} />
          </span>
        )}
        <span className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-white/85">{label}</span>
        {onPin && (
          <button
            type="button"
            onClick={onPin}
            title={pinned ? "Favorit entfernen" : "Als Favorit anpinnen (KPIs oben)"}
            aria-pressed={!!pinned}
            data-testid={testid ? `${testid}-pin` : undefined}
            className="inline-flex items-center justify-center rounded-full border w-6 h-6 transition-colors"
            style={{
              borderColor: pinned ? `${color}88` : "rgba(255,255,255,0.12)",
              background: pinned ? `${color}1f` : "rgba(255,255,255,0.03)",
            }}
          >
            <Star size={12} strokeWidth={2.2} style={{ color: pinned ? color : "rgba(255,255,255,0.45)" }} fill={pinned ? color : "none"} />
          </button>
        )}
        {alarmList.length > 0 && (
          <Badge
            kind={hasCritical ? "KRITISCH" : "WARN"}
            label={`${alarmList.length} ${alarmList.length === 1 ? "Alarm" : "Alarme"}`}
            testid={testid ? `${testid}-alarm` : undefined}
          />
        )}
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
        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            data-testid={testid ? `${testid}-details-toggle` : undefined}
            className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-[0.14em] text-white/55 hover:text-white transition-colors"
          >
            <BookOpen size={11} strokeWidth={2.2} />
            <span>{open ? "schließen" : "details"}</span>
            <ChevronDown size={11} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {hasDetails && open && (
        <div
          className="mt-3 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 rounded-xl"
          style={{ background: "linear-gradient(150deg, #0d1626 0%, #070c18 100%)", border: `1px solid ${color}2a` }}
          data-testid={testid ? `${testid}-details` : undefined}
        >
          {details.map((s) => (
            <div key={s.label}>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] mb-1.5 pb-1 border-b" style={{ color, borderColor: `${color}33` }}>
                {s.label}
              </div>
              <div className="text-[13px] leading-relaxed text-white/75">{s.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
