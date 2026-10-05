/* Phase 2 – Dynamischer Plasma-Energiefluss (SVG).
 * Maximal detaillierte Topologie mit EINZELNEN Geräte-Knoten:
 *   MPPT 1 + MPPT 2 (Victron, DC) -> Akku (Trucki/SUN) -> Haus;
 *   Hoymiles HM1500 (AC) -> Haus;  Netz (Shelly 3EM) <-> Haus.
 * DC-gekoppelt: Victron-MPPTs laden den Akku, Trucki entlädt ihn ins AC-Netz,
 * Hoymiles speist AC direkt. Energieströme als leuchtende Plasma-Bahnen mit
 * Photonen-Schwärmen – Geschwindigkeit/Dichte/Glow skalieren mit der Wattleistung. */
import { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { useMotion } from "../lib/motion";

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

// Physische PV-Konfiguration je Victron-MPPT (vom Nutzer angegeben):
// MPPT 1 = 4× 425 Wp, MPPT 2 = 4× 445 Wp (je 1 String).
const MPPT_ARRAY = [
  { panels: 4, wp: 425 },
  { panels: 4, wp: 445 },
];
const mpptPeak = (i) => (MPPT_ARRAY[i] ? MPPT_ARRAY[i].panels * MPPT_ARRAY[i].wp : 0);

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

function Emblem({ node, reduced }) {
  const ex = node.x - NODE_W / 2 + 34;
  const ey = node.y;
  const anim = node.active && !reduced;
  if (node.emblem === "sun") return <SunEmblem cx={ex} cy={ey} color={node.color} active={node.active} anim={anim} />;
  if (node.emblem === "battery") return <BatteryRing cx={ex} cy={ey} color={node.color} soc={node.soc} active={node.active} anim={anim} />;
  if (node.emblem === "grid") return <GridWave cx={ex} cy={ey} color={node.color} active={node.active} anim={anim} uid={node.key} />;
  return <HouseEmblem cx={ex} cy={ey} color={node.color} active={node.active} anim={anim} />;
}

// ---------- Knoten-Karte ----------

function NodeCard({ node, dim, reduced, onHover }) {
  const { x, y, color, active, value, unit, label, sub, testid, badge, util } = node;
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
      {/* String-Auslastungsbalken (nur MPPT) */}
      {util != null && (
        <g pointerEvents="none">
          <rect x={tx} y={y + 16} width={right - 12 - tx} height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
          <rect x={tx} y={y + 16} width={(right - 12 - tx) * util} height="3" rx="1.5" fill={color} opacity="0.95"
                style={active ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
        </g>
      )}
      {/* Status-Beacon */}
      <circle cx={right - 12} cy={bottom - 12} r="2.6" fill={active ? color : "rgba(148,163,184,0.4)"}
              style={active ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined}>
        {active && !reduced && <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />}
      </circle>
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

function Flow({ flow, hover, reduced, onHover }) {
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
  const dur = flowDurSec(watts);
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

  const m1w = mppts[0]?.pv_power || 0;
  const m2w = mppts[1]?.pv_power || 0;

  // --- Knoten + Flüsse je Ansicht ---
  const nodes = [];
  let allFlows = [];
  if (compact) {
    const pvEnabled = victronEnabled || hoymilesEnabled;
    if (pvEnabled) nodes.push({ key: "pv", x: 530, y: 95, color: COLOR.pv, active: pvProducing, emblem: "sun",
      label: "PV-Block", badge: "AC+DC", value: round(pv), unit: "W", testid: "flow-pv",
      sub: pvProducing ? `AC ${round(pvAc)} · DC ${round(pvDc)} W` : pvNightSub });
    if (gridEnabled) nodes.push({ key: "grid", x: 200, y: 230, color: gridColor, active: importActive || exportActive, emblem: "grid",
      label: "Netz", badge: "PRO 3EM", value: round(Math.abs(grid)), unit: "W", sub: gridLabel, testid: "flow-grid" });
    if (batteryEnabled) nodes.push({ key: "battery", x: 860, y: 230, color: COLOR.battery, active: chargeActive || dischargeActive, emblem: "battery",
      label: "Akku", badge: "TRUCKI", value: round(Math.abs(battery)), unit: "W", sub: batterySub, soc, testid: "flow-battery" });
    nodes.push({ key: "house", x: 530, y: 300, color: COLOR.house, active: houseActive, emblem: "house",
      label: "Haus", badge: "AC-LAST", value: round(house), unit: "W", sub: houseActive ? "Verbrauch" : "Standby", testid: "flow-house" });
    allFlows = [
      { id: "pv-house", from: "pv", to: "house", d: "M 530 136 L 530 259", color: COLOR.pv, active: pvAcActive, watts: pvAc, reverse: false },
      { id: "pv-battery", from: "pv", to: "battery", d: "M 621 110 L 769 215", color: COLOR.dc, active: chargeActive, watts: charge, reverse: false },
      { id: "grid-house", from: "grid", to: "house", d: "M 291 240 L 439 292", color: gridColor, active: importActive || exportActive, watts: Math.abs(grid), reverse: exportActive },
      { id: "battery-house", from: "battery", to: "house", d: "M 769 240 L 621 292", color: COLOR.battery, active: dischargeActive, watts: discharge, reverse: false },
    ];
  } else {
    const MPPT_POS = [{ x: 135, y: 105 }, { x: 135, y: 325 }];
    if (victronEnabled) {
      mppts.slice(0, 2).forEach((m, i) => {
        const w = m.pv_power || 0;
        const peak = mpptPeak(i);
        nodes.push({
          key: `mppt${i + 1}`, x: MPPT_POS[i].x, y: MPPT_POS[i].y, color: COLOR.dc, active: w > 5, emblem: "sun",
          label: `MPPT ${i + 1}`, badge: "1-STR·DC", value: round(w), unit: "W", testid: `flow-mppt${i + 1}`,
          util: peak > 0 ? Math.max(0, Math.min(1, w / peak)) : null,
          sub: w > 5 ? `${f1(m.pv_voltage)} V · ${peak ? Math.round((w / peak) * 100) + "%" : m.state || "–"}` : "inaktiv",
        });
      });
    }
    if (hoymilesEnabled) nodes.push({ key: "hoymiles", x: 725, y: 105, color: COLOR.pv, active: pvAcActive, emblem: "sun",
      label: "Hoymiles", badge: "AHOY-DTU", value: round(pvAc), unit: "W", testid: "flow-hoymiles",
      sub: pvAcActive ? `HM1500 · ${ahoy?.limit_percent ?? 100}%` : pvNightSub });
    if (batteryEnabled) nodes.push({ key: "battery", x: 420, y: 215, color: COLOR.battery, active: chargeActive || dischargeActive, emblem: "battery",
      label: "Akku", badge: "TRUCKI", value: round(Math.abs(battery)), unit: "W", sub: batterySub, soc, testid: "flow-battery" });
    nodes.push({ key: "house", x: 725, y: 325, color: COLOR.house, active: houseActive, emblem: "house",
      label: "Haus", badge: "AC-LAST", value: round(house), unit: "W", sub: houseActive ? "Verbrauch" : "Standby", testid: "flow-house" });
    if (gridEnabled) nodes.push({ key: "grid", x: 965, y: 325, color: gridColor, active: importActive || exportActive, emblem: "grid",
      label: "Netz", badge: "PRO 3EM", value: round(Math.abs(grid)), unit: "W", sub: gridLabel, testid: "flow-grid" });
    allFlows = [
      { id: "mppt1-battery", from: "mppt1", to: "battery", d: "M 226 105 L 329 215", color: COLOR.dc, active: m1w > 5, watts: m1w, reverse: false },
      { id: "mppt2-battery", from: "mppt2", to: "battery", d: "M 226 325 L 329 215", color: COLOR.dc, active: m2w > 5, watts: m2w, reverse: false },
      { id: "battery-house", from: "battery", to: "house", d: "M 511 215 L 634 325", color: COLOR.battery, active: dischargeActive, watts: discharge, reverse: false },
      { id: "hoymiles-house", from: "hoymiles", to: "house", d: "M 725 146 L 725 284", color: COLOR.pv, active: pvAcActive, watts: pvAc, reverse: false },
      { id: "grid-house", from: "grid", to: "house", d: "M 874 325 L 816 325", color: gridColor, active: importActive || exportActive, watts: Math.abs(grid), reverse: exportActive },
    ];
  }

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
      ];
      return { title: m.name || key.toUpperCase(), badge: "VENUS-OS", color: COLOR.dc, rows };
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
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 flex items-center gap-2 shrink-0">
          <Activity size={12} className="text-cyan-400 neon-cyan" />
          <span className="hidden sm:inline">Energiefluss · Live</span>
          <span className="sm:hidden">Fluss</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md overflow-hidden border border-white/12" data-testid="flow-view-toggle" role="group" aria-label="Ansicht">
            {VIEW_OPTS.map((o) => (
              <button key={o.v} type="button" onClick={() => setView(o.v)} aria-pressed={viewPref === o.v}
                data-testid={`flow-view-${o.v}`}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${viewPref === o.v ? "bg-cyan-400/20 text-cyan-200" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
                {o.l}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse text-emerald-400" /> AKTIV
          </span>
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

          {flows.map((f) => <Flow key={f.id} flow={f} hover={hover} reduced={reduced} onHover={setHover} />)}
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
