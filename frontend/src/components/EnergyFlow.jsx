/* Phase 2 – Dynamischer Plasma-Energiefluss (SVG).
 * Maximal detaillierte Topologie mit EINZELNEN Geräte-Knoten:
 *   MPPT 1 + MPPT 2 (Victron, DC) -> Akku (Trucki/SUN) -> Haus;
 *   Hoymiles HM1500 (AC) -> Haus;  Netz (Shelly 3EM) <-> Haus.
 * DC-gekoppelt: Victron-MPPTs laden den Akku, Trucki entlädt ihn ins AC-Netz,
 * Hoymiles speist AC direkt. Energieströme als leuchtende Plasma-Bahnen mit
 * Photonen-Schwärmen – Geschwindigkeit/Dichte/Glow skalieren mit der Wattleistung. */
import { useState, useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import { useMotion } from "../lib/motion";
import { MPPT_ARRAY, mpptPeakW as mpptPeak } from "../lib/mppt";

const COLOR = {
  pv: "#FACC15",        // Hoymiles (AC-Solar)
  dc: "#F59E0B",        // Victron MPPT (DC-Solar -> Akku)
  grid_import: "#F87171",
  grid_export: "#10B981",
  battery: "#06B6D4",
  house: "#cbd5e1",
};

const NODE_W = 182;
const NODE_H = 82;

const round = (w) => Math.round(w || 0);

// Fluss-Dauer aus Leistung: viel Watt -> schneller. 0W≈2.4s … ≥3000W≈0.6s.
function flowDurSec(watts) {
  const w = Math.min(Math.max(watts || 0, 0), 3000);
  return +(2.4 - (w / 3000) * 1.8).toFixed(2);
}

function reversePath(d) {
  const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
  if (!m) return d;
  return `M ${m[3]} ${m[4]} L ${m[1]} ${m[2]}`;
}

function pathMid(d) {
  const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
  if (!m) return { x: 0, y: 0 };
  return { x: (+m[1] + +m[3]) / 2, y: (+m[2] + +m[4]) / 2 };
}

// Verbindungslinie zwischen zwei Knoten-Mittelpunkten: schneidet die Rechteck-
// ränder der Knoten und lässt einen kleinen Abstand (gap), damit die Linie nicht
// in den Karten klebt. Liefert "M x1 y1 L x2 y2".
function edge(a, b, gap = 10) {
  if (!a || !b) return null;
  const dx = b.x - a.x, dy = b.y - a.y;
  const hw = NODE_W / 2, hh = NODE_H / 2;
  const border = (cx, cy, ddx, ddy) => {
    const s = Math.min(hw / (Math.abs(ddx) || 1e-6), hh / (Math.abs(ddy) || 1e-6));
    const len = Math.hypot(ddx, ddy) || 1;
    return { x: cx + ddx * s + (ddx / len) * gap, y: cy + ddy * s + (ddy / len) * gap };
  };
  const p1 = border(a.x, a.y, dx, dy);
  const p2 = border(b.x, b.y, -dx, -dy);
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

// ---------- Knoten-Embleme (lebendige Symbole) ----------

function SunEmblem({ cx, cy, color, active, anim }) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const c = Math.cos(a), s = Math.sin(a);
    rays.push(
      <line key={i} x1={cx + c * 10} y1={cy + s * 10} x2={cx + c * 16} y2={cy + s * 16}
            stroke={color} strokeWidth="2" strokeLinecap="round" opacity={active ? 0.85 : 0.3} />
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r="18" fill={color} opacity={active ? 0.14 : 0.05}>
        {anim && <animate attributeName="r" values="15;20;15" dur="2.8s" repeatCount="indefinite" />}
        {anim && <animate attributeName="opacity" values="0.10;0.22;0.10" dur="2.8s" repeatCount="indefinite" />}
      </circle>
      <g>
        {rays}
        {anim && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="16s" repeatCount="indefinite" />}
      </g>
      <circle cx={cx} cy={cy} r="7" fill={color} opacity={active ? 0.95 : 0.45}
              style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </g>
  );
}

function BatteryRing({ cx, cy, color, soc, active, anim }) {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const filled = (circ * Math.max(0, Math.min(100, soc))) / 100;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${filled} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      {active && (
        <g>
          <circle cx={cx} cy={cy - r} r="2.6" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          {anim && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="3s" repeatCount="indefinite" />}
        </g>
      )}
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fontWeight="600" fill="rgba(255,255,255,0.85)">{round(soc)}</text>
    </g>
  );
}

function GridWave({ cx, cy, color, active, anim, uid }) {
  return (
    <>
      <clipPath id={`gw-${uid}`}><rect x={cx - 17} y={cy - 13} width="34" height="26" /></clipPath>
      <g clipPath={`url(#gw-${uid})`}>
        <g transform={`translate(${cx} ${cy})`}>
          <g>
            <path d="M -24 0 Q -19 -8 -14 0 T -4 0 T 6 0 T 16 0 T 26 0 T 36 0"
                  stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"
                  opacity={active ? 0.9 : 0.35} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
            {anim && <animateTransform attributeName="transform" type="translate" from="0 0" to="-20 0" dur="1.3s" repeatCount="indefinite" />}
          </g>
        </g>
      </g>
      <line x1={cx - 17} y1={cy} x2={cx + 17} y2={cy} stroke={color} strokeWidth="0.6" opacity="0.25" />
    </>
  );
}

function HouseEmblem({ cx, cy, color, active, anim }) {
  return (
    <g opacity={active ? 1 : 0.55} style={{ filter: active ? `drop-shadow(0 0 4px ${color}88)` : "none" }}>
      <path d={`M ${cx - 13} ${cy - 1} L ${cx} ${cy - 13} L ${cx + 13} ${cy - 1}`} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={cx - 9} y={cy - 1} width="18" height="13" rx="1.5" stroke={color} strokeWidth="2" fill="none" />
      {anim && <animate attributeName="opacity" values="0.65;1;0.65" dur="2.4s" repeatCount="indefinite" />}
    </g>
  );
}

function BoltEmblem({ cx, cy, color, active, anim }) {
  return (
    <g opacity={active ? 1 : 0.5} style={{ filter: active ? `drop-shadow(0 0 4px ${color})` : "none" }}>
      <circle cx={cx} cy={cy} r="17" fill={color} opacity={active ? 0.12 : 0.05}>
        {anim && <animate attributeName="opacity" values="0.08;0.22;0.08" dur="2.4s" repeatCount="indefinite" />}
      </circle>
      <path d={`M ${cx + 4} ${cy - 13} L ${cx - 7} ${cy + 2} L ${cx - 1} ${cy + 2} L ${cx - 4} ${cy + 13} L ${cx + 8} ${cy - 3} L ${cx + 1} ${cy - 3} Z`}
            fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

function Emblem({ node, reduced }) {
  const ex = node.x - NODE_W / 2 + 34;
  const ey = node.y;
  const anim = node.active && !reduced;
  if (node.emblem === "sun") return <SunEmblem cx={ex} cy={ey} color={node.color} active={node.active} anim={anim} />;
  if (node.emblem === "battery") return <BatteryRing cx={ex} cy={ey} color={node.color} soc={node.soc} active={node.active} anim={anim} />;
  if (node.emblem === "grid") return <GridWave cx={ex} cy={ey} color={node.color} active={node.active} anim={anim} uid={node.key} />;
  if (node.emblem === "bolt") return <BoltEmblem cx={ex} cy={ey} color={node.color} active={node.active} anim={anim} />;
  return <HouseEmblem cx={ex} cy={ey} color={node.color} active={node.active} anim={anim} />;
}

// ---------- Knoten-Karte ----------

function NodeCard({ node, dim, reduced, onHover }) {
  const { x, y, color, active, value, unit, label, sub, testid, badge, util, peakUtil, warn } = node;
  const left = x - NODE_W / 2;
  const top = y - NODE_H / 2;
  const right = left + NODE_W;
  const bottom = top + NODE_H;
  const tx = left + 62;
  const bw = badge ? 13 + badge.length * 4.9 : 0;
  const bx = right - 8 - bw;
  return (
    <g data-testid={testid}
       onMouseEnter={() => onHover(node.key)} onMouseLeave={() => onHover(null)} onClick={() => onHover(node.key)}
       style={{ opacity: dim ? 0.28 : 1, transition: "opacity 0.3s cubic-bezier(0.4,0,0.2,1)", cursor: "pointer" }}>
      {active && (
        <rect x={left - 2.5} y={top - 2.5} width={NODE_W + 5} height={NODE_H + 5} rx="10" fill="none"
              stroke={color} strokeWidth="1" opacity="0.5" style={{ filter: `drop-shadow(0 0 9px ${color})` }} />
      )}
      {/* Gehäuse (maschiniertes Titan-Glas) */}
      <rect x={left} y={top} width={NODE_W} height={NODE_H} rx="8" fill="url(#nodeFill)"
            stroke={active ? color : "rgba(148,163,184,0.20)"} strokeOpacity={active ? 0.6 : 1} strokeWidth="1" />
      {/* Metallische Oberkanten-Hairline */}
      <line x1={left + 16} y1={top + 1.2} x2={right - 16} y2={top + 1.2} stroke="rgba(226,232,240,0.45)" strokeWidth="1" opacity="0.7" />
      {/* Statusbalken links */}
      <rect x={left} y={top} width="4" height={NODE_H} rx="2" fill={color} opacity="0.92"
            style={active ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined} />
      {/* Taktische Eckwinkel (Aerospace-SCADA) */}
      <path d={`M ${left + 8} ${top + 17} L ${left + 8} ${top + 8} L ${left + 17} ${top + 8}`}
            stroke={color} strokeWidth="1.3" fill="none" opacity={active ? 0.65 : 0.28} strokeLinecap="round" />
      <path d={`M ${right - 8} ${bottom - 17} L ${right - 8} ${bottom - 8} L ${right - 17} ${bottom - 8}`}
            stroke={color} strokeWidth="1.3" fill="none" opacity={active ? 0.65 : 0.28} strokeLinecap="round" />
      <Emblem node={node} reduced={reduced} />
      {/* Geräte-Badge */}
      {badge && (
        <g pointerEvents="none">
          <rect x={bx} y={top + 7} width={bw} height="13.5" rx="3" fill="rgba(2,6,16,0.82)" stroke={color} strokeOpacity="0.45" strokeWidth="0.8" />
          <text x={bx + bw / 2} y={top + 16.6} textAnchor="middle" fontSize="7" fontFamily="JetBrains Mono" fontWeight="600" letterSpacing="0.6" fill={color} opacity="0.9">{badge}</text>
        </g>
      )}
      <text x={tx} y={top + 23} fontSize="10" fontFamily="Chakra Petch, JetBrains Mono" fontWeight="600" letterSpacing="1.1" fill="rgba(226,232,240,0.62)">
        {String(label).toUpperCase()}
      </text>
      <text x={tx} y={y + 10} fontSize="24" fontFamily="JetBrains Mono" fontWeight="600" fill="#ffffff"
            style={active ? { filter: `drop-shadow(0 0 7px ${color}aa)` } : undefined}>
        {value}
        <tspan fontSize="12" fill="rgba(255,255,255,0.45)" dx="4">{unit}</tspan>
      </text>
      {sub && (
        <text x={tx} y={top + NODE_H - 12} fontSize="9.5" fontFamily="JetBrains Mono" fill="rgba(203,213,225,0.58)">
          {sub}
        </text>
      )}
      {/* String-Auslastungsbalken (nur MPPT) + Tages-Peak-Marker */}
      {util != null && (
        <g pointerEvents="none">
          <rect x={tx} y={y + 16} width={right - 12 - tx} height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
          <rect x={tx} y={y + 16} width={(right - 12 - tx) * util} height="3" rx="1.5" fill={color} opacity="0.95"
                style={active ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
          {peakUtil != null && (
            <rect x={tx + (right - 12 - tx) * peakUtil - 0.8} y={y + 13.5} width="1.6" height="8" rx="0.8" fill="#e2e8f0" opacity="0.85">
              <title>Tages-Peak</title>
            </rect>
          )}
        </g>
      )}
      {/* Status-Beacon */}
      <circle cx={right - 12} cy={bottom - 12} r="2.6" fill={active ? color : "rgba(148,163,184,0.4)"}
              style={active ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined}>
        {active && !reduced && <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />}
      </circle>
      {/* Verschattungs-Warnung */}
      {warn && (
        <g transform={`translate(${right - 30}, ${y - 8})`} pointerEvents="none">
          <title>Mögliche Teilverschattung</title>
          <path d="M7 0 L14 12 L0 12 Z" fill="rgba(245,158,11,0.14)" stroke="#f59e0b" strokeWidth="1.3" strokeLinejoin="round" />
          <rect x="6.1" y="3.8" width="1.8" height="4.4" rx="0.9" fill="#f59e0b" />
          <circle cx="7" cy="10" r="1" fill="#f59e0b" />
          {!reduced && <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />}
        </g>
      )}
    </g>
  );
}

// ---------- Plasma-Fluss ----------

function Photons({ d, color, reverse, dur, n }) {
  const path = reverse ? reversePath(d) : d;
  return [...Array(n)].map((_, i) => (
    <circle key={i} r="2.4" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
      <animateMotion dur={`${dur}s`} begin={`${-(dur / n) * i}s`} repeatCount="indefinite" path={path} calcMode="linear" />
    </circle>
  ));
}

function Flow({ flow, hover, reduced, onHover, tempo = 1 }) {
  const { d, color, active, watts, reverse, id, from, to } = flow;
  const related = !hover || [id, from, to].includes(hover);
  const dim = hover && !related;
  const style = { opacity: dim ? 0.28 : 1, transition: "opacity 0.3s cubic-bezier(0.4,0,0.2,1)" };
  if (!active) {
    return (
      <g style={style}>
        <path d={d} stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" fill="none" strokeDasharray="2 7" />
        <path d={d} stroke="transparent" strokeWidth="18" fill="none" style={{ cursor: "pointer" }}
              onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)} />
      </g>
    );
  }
  const dur = +(flowDurSec(watts) / (tempo || 1)).toFixed(2);
  const intensity = Math.min((watts || 0) / 3000, 1);
  const halo = 0.1 + intensity * 0.22;
  const haloW = 6 + intensity * 7;
  const n = watts < 150 ? 1 : watts < 600 ? 2 : watts < 1500 ? 3 : 4;
  const emph = hover && related;
  return (
    <g style={style}>
      <path d={d} stroke={color} strokeWidth={haloW} fill="none" opacity={halo} strokeLinecap="round" />
      <path d={d} stroke={color} strokeWidth="2" fill="none" opacity="0.22" strokeLinecap="round" />
      <path d={d} stroke={color} strokeWidth={emph ? 4.5 : 3.5} fill="none"
            className={reduced ? "" : (reverse ? "flow-particles reverse" : "flow-particles")} strokeLinecap="round"
            style={{ animationDuration: `${dur}s`, filter: `drop-shadow(0 0 ${emph ? 6 : 4}px ${color})` }} />
      {!reduced && <Photons d={d} color={color} reverse={reverse} dur={dur} n={n} />}
      <path d={d} stroke="transparent" strokeWidth="18" fill="none" style={{ cursor: "pointer" }}
            onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)} />
    </g>
  );
}

function ValuePill({ x, y, text, color }) {
  const w = 20 + text.length * 7;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={x - w / 2} y={y - 11} width={w} height="22" rx="5" fill="rgba(2,6,16,0.94)" stroke={color} strokeWidth="1" />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fontWeight="600" fill="#ffffff">{text}</text>
    </g>
  );
}

// ---------- Hauptkomponente ----------

const avg = (a) => (a.length ? a.reduce((s, x) => s + (x || 0), 0) / a.length : null);
const sumA = (a) => (a.length ? a.reduce((s, x) => s + (x || 0), 0) : null);
const f1 = (x) => (x == null || isNaN(x) ? "n/a" : Math.round(x * 10) / 10);

export default function EnergyFlow({ summary, trucki, devices, shelly, ahoy, victron, timestamp, sun }) {
  const [hover, setHover] = useState(null);
  const { reduced } = useMotion();

  // Tages-Peak je MPPT (Höchstwert seit Mitternacht, Reset bei Datumswechsel).
  const peakRef = useRef({ day: null, vals: {} });
  const _todayKey = new Date().toDateString();
  if (peakRef.current.day !== _todayKey) peakRef.current = { day: _todayKey, vals: {} };

  const pv = summary?.pv_power || 0;
  const pvAc = summary?.pv_ac_power ?? pv;
  const pvDc = summary?.pv_dc_power || 0;
  const grid = summary?.grid_power || 0;
  const battery = summary?.battery_power || 0;
  const charge = summary?.battery_charge_w || 0;
  const discharge = summary?.battery_discharge_w || 0;
  const house = summary?.house_power || 0;
  const soc = summary?.battery_soc || 0;

  const importActive = grid > 20;
  const exportActive = grid < -20;
  const pvAcActive = pvAc > 5;
  const chargeActive = charge > 20;
  const dischargeActive = discharge > 20;
  const houseActive = house > 5;
  const pvProducing = pv > 5;

  // Tag/Nacht aus realen Auf-/Untergangszeiten (Standort, UTC-Instant);
  // Fallback auf festes 05–21-Uhr-Modell, falls keine Sonnenzeiten vorliegen.
  const _nowMs = timestamp ? new Date(timestamp).getTime() : Date.now();
  const _srMs = sun?.sunrise ? new Date(sun.sunrise).getTime() : null;
  const _ssMs = sun?.sunset ? new Date(sun.sunset).getTime() : null;
  let isNight, hoursToSunrise;
  if (_srMs != null && _ssMs != null && _ssMs > _srMs) {
    isNight = !(_nowMs >= _srMs && _nowMs < _ssMs);
    hoursToSunrise = _nowMs < _srMs ? (_srMs - _nowMs) / 3600000 : (_srMs + 86400000 - _nowMs) / 3600000;
  } else {
    const _now = timestamp ? new Date(timestamp) : new Date();
    const _h = _now.getUTCHours() + _now.getUTCMinutes() / 60;
    isNight = _h < 5 || _h >= 21;
    hoursToSunrise = _h < 5 ? 5 - _h : 24 - _h + 5;
  }
  const sunriseStr = `${hoursToSunrise.toFixed(1).replace(".", ",")} h`;
  const pvNightSub = isNight ? `Sonnenaufgang in ${sunriseStr}` : "inaktiv";

  const gridColor = grid >= 0 ? COLOR.grid_import : COLOR.grid_export;
  let gridLabel = "ausgeglichen";
  if (importActive) gridLabel = "Bezug";
  else if (exportActive) gridLabel = "Einspeisung";

  let batterySub = `${round(soc)}% · ↑${round(charge)} ↓${round(discharge)}W`;
  if (trucki?.zepc && trucki?.ac_setpoint_w) batterySub = `${round(soc)}% · ZEPC ${round(trucki.ac_setpoint_w)}W`;

  // Geräte-Aktivierung steuert, welche Knoten erscheinen (Default: an).
  const en = (k) => devices?.[k]?.enabled !== false;
  const victronEnabled = en("victron");
  const hoymilesEnabled = en("ahoy");
  const gridEnabled = en("shelly");
  const batteryEnabled = en("trucki");

  const mppts = victron?.mppts || [];

  // Kompakt/Detail-Ansicht (Auto: Handy=Kompakt, Desktop=Detail), in localStorage gemerkt.
  const [viewPref, setViewPref] = useState(() => {
    try { return localStorage.getItem("solar.flowView") || "auto"; } catch { return "auto"; }
  });
  const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 1024 : false));
  useEffect(() => {
    const h = () => setNarrow(window.innerWidth < 1024);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const setView = (v) => { setViewPref(v); try { localStorage.setItem("solar.flowView", v); } catch { /* ignore */ } };
  const mode = viewPref === "auto" ? (narrow ? "compact" : "detail") : viewPref;
  const compact = mode === "compact";

  // Steuerleiste: Partikelfluss an/aus + Tempo (1× / 1.5× / 2×), in localStorage gemerkt.
  const [flowOn, setFlowOn] = useState(() => { try { return localStorage.getItem("solar.flowOn") !== "0"; } catch { return true; } });
  const [tempo, setTempo] = useState(() => { try { return parseFloat(localStorage.getItem("solar.flowTempo")) || 1; } catch { return 1; } });
  const toggleFlow = () => setFlowOn((v) => { const n = !v; try { localStorage.setItem("solar.flowOn", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  const setTempoPersist = (t) => { setTempo(t); try { localStorage.setItem("solar.flowTempo", String(t)); } catch { /* ignore */ } };
  const flowAnim = flowOn && !reduced;

  // --- Knoten + Flüsse je Ansicht ---
  // Kompakt = 5 Knoten (Solar PV gebündelt), Detail = 6 Knoten (PV in Hoymiles AC
  // + Victron MPPT DC aufgeteilt). Übrige Knoten identisch. Kanten werden aus den
  // Knotenpositionen berechnet (edge()). Physik: PV(AC)->Haus, PV(DC)->Akku (Laden),
  // Akku->Sun-2000->Haus (Entladen über Trucki-Regler), Netz<->Haus.
  const nodeList = [];
  let flowDefs = [];
  const sun2000Sub = dischargeActive ? `Regler · Lim ${round(trucki?.max_power_w || 0)}W` : "Standby";
  if (compact) {
    const pvEnabled = victronEnabled || hoymilesEnabled;
    if (pvEnabled) nodeList.push({ key: "pv", x: 175, y: 110, color: COLOR.pv, active: pvProducing, emblem: "sun",
      label: "Solar PV", badge: "AC+DC", value: round(pv), unit: "W", testid: "flow-pv",
      sub: pvProducing ? `AC ${round(pvAc)} · DC ${round(pvDc)} W` : pvNightSub });
    if (gridEnabled) nodeList.push({ key: "grid", x: 175, y: 320, color: gridColor, active: importActive || exportActive, emblem: "grid",
      label: "Stromnetz", badge: "PRO 3EM", value: round(Math.abs(grid)), unit: "W", sub: gridLabel, testid: "flow-grid" });
    nodeList.push({ key: "house", x: 530, y: 215, color: COLOR.house, active: houseActive, emblem: "house",
      label: "Hausverbrauch", badge: "AC-LAST", value: round(house), unit: "W", sub: houseActive ? "Verbrauch" : "Standby", testid: "flow-house" });
    if (batteryEnabled) {
      nodeList.push({ key: "battery", x: 885, y: 110, color: COLOR.battery, active: chargeActive || dischargeActive, emblem: "battery",
        label: "Batterie 48V", badge: "48V", value: round(Math.abs(battery)), unit: "W", sub: batterySub, soc, testid: "flow-battery" });
      nodeList.push({ key: "sun2000", x: 885, y: 320, color: COLOR.dc, active: dischargeActive, emblem: "bolt",
        label: "Sun-2000", badge: "TRUCKI", value: round(discharge), unit: "W", sub: sun2000Sub, testid: "flow-sun2000" });
    }
    flowDefs = [
      { id: "pv-house", from: "pv", to: "house", color: COLOR.pv, active: pvAcActive, watts: pvAc },
      { id: "pv-battery", from: "pv", to: "battery", color: COLOR.dc, active: chargeActive, watts: charge },
      { id: "battery-sun2000", from: "battery", to: "sun2000", color: COLOR.battery, active: dischargeActive, watts: discharge },
      { id: "sun2000-house", from: "sun2000", to: "house", color: COLOR.dc, active: dischargeActive, watts: discharge },
      { id: "grid-house", from: "grid", to: "house", color: gridColor, active: importActive || exportActive, watts: Math.abs(grid), reverse: exportActive },
    ];
  } else {
    if (hoymilesEnabled) nodeList.push({ key: "hoymiles", x: 155, y: 80, color: COLOR.pv, active: pvAcActive, emblem: "sun",
      label: "Hoymiles", badge: "AHOY-DTU", value: round(pvAc), unit: "W", testid: "flow-hoymiles",
      sub: pvAcActive ? `HM1500 · ${ahoy?.limit_percent ?? 100}%` : pvNightSub });
    if (victronEnabled) nodeList.push({ key: "victron", x: 155, y: 210, color: COLOR.dc, active: pvDc > 5, emblem: "sun",
      label: "Victron MPPT", badge: "VENUS-OS", value: round(pvDc), unit: "W", testid: "flow-victron",
      sub: pvDc > 5 ? `DC · ${mppts.length}× String` : (isNight ? pvNightSub : "inaktiv") });
    if (gridEnabled) nodeList.push({ key: "grid", x: 155, y: 340, color: gridColor, active: importActive || exportActive, emblem: "grid",
      label: "Stromnetz", badge: "PRO 3EM", value: round(Math.abs(grid)), unit: "W", sub: gridLabel, testid: "flow-grid" });
    nodeList.push({ key: "house", x: 530, y: 210, color: COLOR.house, active: houseActive, emblem: "house",
      label: "Hausverbrauch", badge: "AC-LAST", value: round(house), unit: "W", sub: houseActive ? "Verbrauch" : "Standby", testid: "flow-house" });
    if (batteryEnabled) {
      nodeList.push({ key: "battery", x: 905, y: 120, color: COLOR.battery, active: chargeActive || dischargeActive, emblem: "battery",
        label: "Batterie 48V", badge: "48V", value: round(Math.abs(battery)), unit: "W", sub: batterySub, soc, testid: "flow-battery" });
      nodeList.push({ key: "sun2000", x: 905, y: 300, color: COLOR.dc, active: dischargeActive, emblem: "bolt",
        label: "Sun-2000", badge: "TRUCKI", value: round(discharge), unit: "W", sub: sun2000Sub, testid: "flow-sun2000" });
    }
    flowDefs = [
      { id: "hoymiles-house", from: "hoymiles", to: "house", color: COLOR.pv, active: pvAcActive, watts: pvAc },
      { id: "victron-battery", from: "victron", to: "battery", color: COLOR.dc, active: chargeActive, watts: charge },
      { id: "battery-sun2000", from: "battery", to: "sun2000", color: COLOR.battery, active: dischargeActive, watts: discharge },
      { id: "sun2000-house", from: "sun2000", to: "house", color: COLOR.dc, active: dischargeActive, watts: discharge },
      { id: "grid-house", from: "grid", to: "house", color: gridColor, active: importActive || exportActive, watts: Math.abs(grid), reverse: exportActive },
    ];
  }
  const nodes = nodeList;
  const nodeByKey = {};
  nodes.forEach((n) => { nodeByKey[n.key] = n; });
  const allFlows = flowDefs
    .filter((f) => nodeByKey[f.from] && nodeByKey[f.to])
    .map((f) => ({ ...f, d: edge(nodeByKey[f.from], nodeByKey[f.to]), reverse: !!f.reverse }));

  const present = new Set(nodes.map((n) => n.key));
  const flows = allFlows.filter((f) => present.has(f.from) && present.has(f.to));

  const nodeKeys = {};
  nodes.forEach((n) => { nodeKeys[n.key] = [n.key]; });
  flows.forEach((f) => { nodeKeys[f.from]?.push(f.id); nodeKeys[f.to]?.push(f.id); });

  const activePills = hover
    ? flows.filter((f) => f.active && [f.id, f.from, f.to].includes(hover))
    : [];

  // Mini-Inspektor-Panel: zusätzliche Messwerte je Knoten
  const isNodeHover = hover && !hover.includes("-");
  const ahoyCh = ahoy?.channels || [];
  const acV = avg(ahoyCh.map((c) => c.voltage));
  const acI = sumA(ahoyCh.map((c) => c.current));
  const dcV = avg(mppts.map((m) => m.pv_voltage));
  const phasesArr = shelly?.phases || [];

  const buildDetail = (key) => {
    if (key === "pv") {
      const rows = [{ l: "Gesamt", v: `${round(pv)} W` }, { l: "AC · Hoymiles", v: `${round(pvAc)} W` }];
      if (acV != null) rows.push({ l: "· Ø Spannung", v: `${f1(acV)} V` });
      rows.push({ l: "DC · Victron", v: `${round(pvDc)} W` });
      if (dcV != null) rows.push({ l: "· Ø PV-Spannung", v: `${f1(dcV)} V` });
      if (!pvProducing && isNight) rows.push({ l: "Sonnenaufgang", v: `in ${sunriseStr}` });
      return { title: "PV-Block", badge: "AC+DC", color: COLOR.pv, rows };
    }
    if (key.startsWith("mppt")) {
      const idx = key === "mppt1" ? 0 : 1;
      const m = mppts[idx] || {};
      const p = m.pv_power || 0;
      const u = m.pv_voltage || 0;
      const cur = u > 0 ? p / u : 0;
      const cfg = MPPT_ARRAY[idx] || { panels: 4, wp: 0 };
      const peak = mpptPeak(idx);
      const pct = peak > 0 ? Math.round((p / peak) * 100) : 0;
      const dayPeak = Math.max(peakRef.current.vals[idx] || 0, p);
      const peakPct = peak > 0 ? Math.round((dayPeak / peak) * 100) : 0;
      const rows = [
        { l: "PV-Leistung", v: `${round(p)} W` },
        { l: "PV-Spannung", v: `${f1(u)} V` },
        { l: "PV-Strom", v: `${f1(cur)} A` },
        { l: "Batterie", v: `${f1(m.battery_voltage)} V` },
        { l: "Status", v: m.state || "–" },
        { l: "Ertrag heute", v: `${f1(m.yield_today)} kWh` },
        { l: "Modulfeld", v: `${cfg.panels}× ${cfg.wp} Wp` },
        { l: "String-Peak", v: `${peak} Wp` },
        { l: "Auslastung", v: `${round(p)} / ${peak} Wp · ${pct} %` },
        { l: "Peak heute", v: `${round(dayPeak)} W · ${peakPct} %` },
      ];
      if (nodes.find((n) => n.key === key)?.warn) rows.push({ l: "Hinweis", v: "⚠ Mögliche Teilverschattung" });
      return { title: m.name || key.toUpperCase(), badge: "VENUS-OS", color: COLOR.dc, rows };
    }
    if (key === "victron") {
      const rows = [{ l: "DC-Leistung", v: `${round(pvDc)} W` }];
      mppts.forEach((m, i) => rows.push({ l: m.name || `MPPT ${i + 1}`, v: `${round(m.pv_power)} W · ${f1(m.pv_voltage)} V` }));
      if (dcV != null) rows.push({ l: "Ø PV-Spannung", v: `${f1(dcV)} V` });
      rows.push({ l: "Ertrag heute", v: `${f1(mppts.reduce((a, m) => a + (m.yield_today || 0), 0))} kWh` });
      rows.push({ l: "Modulfelder", v: "4× 425 + 4× 445 Wp" });
      return { title: "Victron MPPT", badge: "VENUS-OS", color: COLOR.dc, rows };
    }
    if (key === "sun2000") {
      const rows = [
        { l: "AC-Ausgang", v: `${round(discharge)} W` },
        { l: "Soll / Ist", v: `${round(trucki?.target_w || 0)} / ${round(trucki?.ac_display_w || 0)} W` },
        { l: "Limit", v: `${round(trucki?.max_power_w || 0)} W` },
        { l: "ZEPC", v: trucki?.zepc ? "EIN" : "AUS" },
        { l: "AC-Output", v: trucki?.ac_output ? "EIN" : "AUS" },
      ];
      return { title: "Sun-2000 · Trucki", badge: "TRUCKI", color: COLOR.dc, rows };
    }
    if (key === "hoymiles") {
      const rows = [
        { l: "AC Leistung", v: `${round(pvAc)} W` },
        { l: "Limit", v: `${ahoy?.limit_percent ?? 100} %` },
      ];
      ahoyCh.forEach((c) => rows.push({ l: `Kanal ${c.ch}`, v: `${round(c.power)} W · ${f1(c.voltage)} V` }));
      if (acV != null) rows.push({ l: "Ø Spannung", v: `${f1(acV)} V` });
      if (acI != null) rows.push({ l: "Σ Strom", v: `${f1(acI)} A` });
      if (!pvAcActive && isNight) rows.push({ l: "Sonnenaufgang", v: `in ${sunriseStr}` });
      return { title: "Hoymiles HM1500", badge: "AHOY-DTU", color: COLOR.pv, rows };
    }
    if (key === "grid") {
      const rows = [{ l: "Σ Leistung", v: `${round(Math.abs(grid))} W` }, { l: "Status", v: gridLabel }];
      phasesArr.forEach((p) => rows.push({ l: p.phase, v: `${f1(p.voltage)} V · ${f1(p.current)} A` }));
      return { title: "Netz · Shelly 3EM", badge: "PRO 3EM", color: gridColor, rows };
    }
    if (key === "battery") {
      const kind = charge > discharge ? "Laden" : discharge > 0 ? "Entladen" : "Leerlauf";
      const rows = [{ l: "Ladezustand", v: `${round(soc)} %` }];
      if (trucki?.battery_voltage != null) rows.push({ l: "Spannung", v: `${f1(trucki.battery_voltage)} V` });
      rows.push({ l: "Leistung", v: `${round(Math.abs(battery))} W · ${kind}` });
      rows.push({ l: "DC-Ladung", v: `${round(charge)} W` });
      if (trucki?.temperature != null) rows.push({ l: "Temperatur", v: `${round(trucki.temperature)} °C` });
      rows.push({ l: "ZEPC", v: trucki?.zepc ? "EIN" : "AUS" });
      return { title: "Akku · Trucki/SUN", badge: "TRUCKI", color: COLOR.battery, rows };
    }
    const rows = [
      { l: "Verbrauch", v: `${round(house)} W` },
      { l: "von Hoymiles", v: `${round(pvAc)} W` },
      { l: "aus Akku", v: `${round(discharge)} W` },
      { l: "aus Netz", v: `${round(Math.max(0, grid))} W` },
    ];
    return { title: "Haus", badge: "AC-LAST", color: COLOR.house, rows };
  };
  const detail = isNodeHover ? buildDetail(hover) : null;

  const VIEW_OPTS = [{ v: "auto", l: "Auto" }, { v: "compact", l: "Kompakt" }, { v: "detail", l: "Detail" }];

  return (
    <div className="glass-strong h-full flex flex-col">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 flex items-center gap-2 shrink-0">
          <Activity size={12} className="text-cyan-400 neon-cyan" />
          <span className="hidden sm:inline">Energiefluss · Live</span>
          <span className="sm:hidden">Fluss</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Fluss an/aus */}
          <button type="button" onClick={toggleFlow} aria-pressed={flowOn} data-testid="flow-toggle-anim"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${flowOn ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/12 text-white/50 hover:text-white hover:bg-white/5"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${flowOn ? "bg-emerald-400 dot-pulse" : "bg-white/40"}`} />
            {flowOn ? "Fluss aktiv" : "Fluss aus"}
          </button>
          {/* Tempo */}
          <div className="inline-flex items-center rounded-md overflow-hidden border border-white/12" data-testid="flow-tempo" role="group" aria-label="Tempo">
            <span className="px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/40 border-r border-white/10">Tempo</span>
            {[1, 1.5, 2].map((t) => (
              <button key={t} type="button" onClick={() => setTempoPersist(t)} aria-pressed={tempo === t}
                data-testid={`flow-tempo-${String(t).replace(".", "_")}`}
                className={`px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${tempo === t ? "bg-cyan-400/20 text-cyan-200" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
                {t}×
              </button>
            ))}
          </div>
          {/* Ansicht */}
          <div className="inline-flex rounded-md overflow-hidden border border-white/12" data-testid="flow-view-toggle" role="group" aria-label="Ansicht">
            {VIEW_OPTS.map((o) => (
              <button key={o.v} type="button" onClick={() => setView(o.v)} aria-pressed={viewPref === o.v}
                data-testid={`flow-view-${o.v}`}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${viewPref === o.v ? "bg-cyan-400/20 text-cyan-200" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 flex-1 flex items-center relative">
        {detail && (
          <div className="absolute top-3 right-3 z-10 w-[216px] pointer-events-none" data-testid="flow-inspector">
            <div className="rounded-md border px-3 py-2.5" style={{ background: "rgba(6,11,24,0.96)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: `${detail.color}66`, boxShadow: `0 0 18px ${detail.color}26, 0 12px 28px -14px rgba(0,0,0,0.9)` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: detail.color, boxShadow: `0 0 7px ${detail.color}` }} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/85 truncate" data-testid="flow-inspector-title">{detail.title}</span>
                </div>
                {detail.badge && <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded shrink-0" style={{ color: detail.color, border: `0.8px solid ${detail.color}66` }}>{detail.badge}</span>}
              </div>
              <dl className="space-y-1">
                {detail.rows.map((r, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <dt className="font-mono text-[10px] text-white/45">{r.l}</dt>
                    <dd className="font-mono text-[11px] text-white/90 text-right">{r.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
        <svg viewBox="0 0 1060 420" className="w-full" data-testid="energy-flow-svg" style={{ maxHeight: 540 }}>
          <defs>
            <pattern id="bggrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="efcenter" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="rgba(6,182,212,0.05)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="nodeFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(17,24,39,0.94)" />
              <stop offset="100%" stopColor="rgba(7,12,24,0.97)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="1060" height="420" fill="url(#bggrid)" />
          <rect x="0" y="0" width="1060" height="420" fill="url(#efcenter)" />
          {[[180, 70], [900, 70], [180, 360], [900, 360], [530, 215]].map(([cx, cy], i) => (
            <g key={i} stroke="rgba(148,163,184,0.16)" strokeWidth="0.8" pointerEvents="none">
              <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} />
              <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} />
            </g>
          ))}

          {flows.map((f) => <Flow key={f.id} flow={f} hover={hover} reduced={!flowAnim} onHover={setHover} tempo={tempo} />)}
          {nodes.map((n) => (
            <NodeCard key={n.key} node={n} dim={hover && !nodeKeys[n.key]?.includes(hover)} reduced={reduced} onHover={setHover} />
          ))}
          {activePills.map((f) => {
            const m = pathMid(f.d);
            return <ValuePill key={f.id} x={m.x} y={m.y} text={`${round(f.watts)} W`} color={f.color} />;
          })}
        </svg>
      </div>
    </div>
  );
}
