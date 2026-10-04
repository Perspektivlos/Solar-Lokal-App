/* Phase 2 – Dynamischer Plasma-Energiefluss (SVG).
 * Logisch gruppierte Knoten (PV-Block / Akku / Netz / Haus), dynamisch je nach
 * aktivierten Geräten. Energieströme als leuchtende Plasma-Bahnen mit Photonen-
 * Schwärmen – Geschwindigkeit, Dichte und Glow skalieren mit der Wattleistung.
 * Interaktiv: Knoten/Pfad überfahren hebt den Pfad hervor und blendet Werte ein. */
import { useState } from "react";
import { Activity } from "lucide-react";

const COLOR = {
  pv: "#FACC15",
  grid_import: "#F87171",
  grid_export: "#10B981",
  battery: "#06B6D4",
  house: "#cbd5e1",
};

const NODE_W = 190;
const NODE_H = 92;

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

function SunEmblem({ cx, cy, color, active }) {
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
        {active && <animate attributeName="r" values="15;20;15" dur="2.8s" repeatCount="indefinite" />}
        {active && <animate attributeName="opacity" values="0.10;0.22;0.10" dur="2.8s" repeatCount="indefinite" />}
      </circle>
      <g>
        {rays}
        {active && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="16s" repeatCount="indefinite" />}
      </g>
      <circle cx={cx} cy={cy} r="7" fill={color} opacity={active ? 0.95 : 0.45}
              style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </g>
  );
}

function BatteryRing({ cx, cy, color, soc, active }) {
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
          <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="3s" repeatCount="indefinite" />
        </g>
      )}
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fontWeight="600" fill="rgba(255,255,255,0.85)">{round(soc)}</text>
    </g>
  );
}

function GridWave({ cx, cy, color, active, uid }) {
  return (
    <>
      <clipPath id={`gw-${uid}`}><rect x={cx - 17} y={cy - 13} width="34" height="26" /></clipPath>
      <g clipPath={`url(#gw-${uid})`}>
        <g transform={`translate(${cx} ${cy})`}>
          <g>
            <path d="M -24 0 Q -19 -8 -14 0 T -4 0 T 6 0 T 16 0 T 26 0 T 36 0"
                  stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"
                  opacity={active ? 0.9 : 0.35} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
            {active && <animateTransform attributeName="transform" type="translate" from="0 0" to="-20 0" dur="1.3s" repeatCount="indefinite" />}
          </g>
        </g>
      </g>
      <line x1={cx - 17} y1={cy} x2={cx + 17} y2={cy} stroke={color} strokeWidth="0.6" opacity="0.25" />
    </>
  );
}

function HouseEmblem({ cx, cy, color, active }) {
  return (
    <g opacity={active ? 1 : 0.55} style={{ filter: active ? `drop-shadow(0 0 4px ${color}88)` : "none" }}>
      <path d={`M ${cx - 13} ${cy - 1} L ${cx} ${cy - 13} L ${cx + 13} ${cy - 1}`} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={cx - 9} y={cy - 1} width="18" height="13" rx="1.5" stroke={color} strokeWidth="2" fill="none" />
      {active && <animate attributeName="opacity" values="0.65;1;0.65" dur="2.4s" repeatCount="indefinite" />}
    </g>
  );
}

function Emblem({ node }) {
  const ex = node.x - NODE_W / 2 + 34;
  const ey = node.y;
  if (node.emblem === "sun") return <SunEmblem cx={ex} cy={ey} color={node.color} active={node.active} />;
  if (node.emblem === "battery") return <BatteryRing cx={ex} cy={ey} color={node.color} soc={node.soc} active={node.active} />;
  if (node.emblem === "grid") return <GridWave cx={ex} cy={ey} color={node.color} active={node.active} uid={node.key} />;
  return <HouseEmblem cx={ex} cy={ey} color={node.color} active={node.active} />;
}

// ---------- Knoten-Karte ----------

function NodeCard({ node, dim, onHover }) {
  const { x, y, color, active, value, unit, label, sub, testid } = node;
  const left = x - NODE_W / 2;
  const top = y - NODE_H / 2;
  const tx = left + 66;
  return (
    <g data-testid={testid}
       onMouseEnter={() => onHover(node.key)} onMouseLeave={() => onHover(null)} onClick={() => onHover(node.key)}
       style={{ opacity: dim ? 0.3 : 1, transition: "opacity 0.25s", cursor: "pointer" }}>
      {active && (
        <rect x={left - 2} y={top - 2} width={NODE_W + 4} height={NODE_H + 4} rx="9" fill="none"
              stroke={color} strokeWidth="1" opacity="0.45" style={{ filter: `drop-shadow(0 0 7px ${color})` }} />
      )}
      <rect x={left} y={top} width={NODE_W} height={NODE_H} rx="7" fill="rgba(13,19,33,0.85)"
            stroke={active ? `${color}` : "rgba(255,255,255,0.10)"} strokeOpacity={active ? 0.5 : 1} strokeWidth="1" />
      <rect x={left} y={top} width="4" height={NODE_H} rx="2" fill={color} opacity="0.85" />
      <Emblem node={node} />
      <text x={tx} y={top + 22} fontSize="10" fontFamily="JetBrains Mono" fontWeight="700" letterSpacing="1.4" fill="rgba(255,255,255,0.55)">
        {String(label).toUpperCase()}
      </text>
      <text x={tx} y={y + 8} fontSize="26" fontFamily="JetBrains Mono" fontWeight="500" fill="#ffffff"
            style={active ? { filter: `drop-shadow(0 0 6px ${color}99)` } : undefined}>
        {value}
        <tspan fontSize="12" fill="rgba(255,255,255,0.45)" dx="4">{unit}</tspan>
      </text>
      {sub && (
        <text x={tx} y={top + NODE_H - 12} fontSize="9.5" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.55)">
          {sub}
        </text>
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

function Flow({ flow, hover, onHover }) {
  const { d, color, active, watts, reverse, id, from, to } = flow;
  const related = !hover || [id, from, to].includes(hover);
  const dim = hover && !related;
  const style = { opacity: dim ? 0.28 : 1, transition: "opacity 0.25s" };
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
            className={reverse ? "flow-particles reverse" : "flow-particles"} strokeLinecap="round"
            style={{ animationDuration: `${dur}s`, filter: `drop-shadow(0 0 ${emph ? 6 : 4}px ${color})` }} />
      <Photons d={d} color={color} reverse={reverse} dur={dur} n={n} />
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

export default function EnergyFlow({ summary, trucki, devices, shelly, ahoy, victron, timestamp }) {
  const [hover, setHover] = useState(null);

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

  // Tag/Nacht nach demselben Sonnenmodell wie die Mock-Daten (UTC, 05–21 Uhr).
  // Nachts zeigt der PV-Knoten dezent die Zeit bis zum Sonnenaufgang.
  const SUNRISE_H = 5, SUNSET_H = 21;
  const _now = timestamp ? new Date(timestamp) : new Date();
  const _h = _now.getUTCHours() + _now.getUTCMinutes() / 60;
  const isNight = _h < SUNRISE_H || _h >= SUNSET_H;
  const hoursToSunrise = _h < SUNRISE_H ? SUNRISE_H - _h : 24 - _h + SUNRISE_H;
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
  const pvEnabled = en("ahoy") || en("victron");
  const gridEnabled = en("shelly");
  const batteryEnabled = en("trucki");

  const nodes = [];
  if (pvEnabled) nodes.push({ key: "pv", x: 450, y: 66, color: COLOR.pv, active: pvProducing, emblem: "sun",
    label: "PV-Block", value: round(pv), unit: "W", testid: "flow-pv",
    sub: pvProducing ? `AC ${round(pvAc)} · DC ${round(pvDc)} W` : pvNightSub });
  if (gridEnabled) nodes.push({ key: "grid", x: 120, y: 210, color: gridColor, active: importActive || exportActive, emblem: "grid",
    label: "Netz", value: round(Math.abs(grid)), unit: "W", sub: gridLabel, testid: "flow-grid" });
  if (batteryEnabled) nodes.push({ key: "battery", x: 780, y: 210, color: COLOR.battery, active: chargeActive || dischargeActive, emblem: "battery",
    label: "Akku", value: round(Math.abs(battery)), unit: "W", sub: batterySub, soc, testid: "flow-battery" });
  nodes.push({ key: "house", x: 450, y: 210, color: COLOR.house, active: houseActive, emblem: "house",
    label: "Haus", value: round(house), unit: "W", sub: houseActive ? "Verbrauch" : "Standby", testid: "flow-house" });

  const present = new Set(nodes.map((n) => n.key));
  const allFlows = [
    { id: "pv-house", from: "pv", to: "house", d: "M 450 112 L 450 164", color: COLOR.pv, active: pvAcActive, watts: pvAc, reverse: false },
    { id: "pv-batt", from: "pv", to: "battery", d: "M 522 100 L 712 168", color: COLOR.pv, active: chargeActive, watts: charge, reverse: false },
    { id: "grid-house", from: "grid", to: "house", d: "M 210 210 L 360 210", color: gridColor, active: importActive || exportActive, watts: Math.abs(grid), reverse: exportActive },
    { id: "batt-house", from: "battery", to: "house", d: "M 692 210 L 540 210", color: COLOR.battery, active: dischargeActive, watts: discharge, reverse: false },
  ];
  const flows = allFlows.filter((f) => present.has(f.from) && present.has(f.to));

  const nodeKeys = {};
  nodes.forEach((n) => { nodeKeys[n.key] = [n.key]; });
  flows.forEach((f) => { nodeKeys[f.from]?.push(f.id); nodeKeys[f.to]?.push(f.id); });

  const activePills = hover
    ? flows.filter((f) => f.active && [f.id, f.from, f.to].includes(hover))
    : [];

  // Mini-Inspektor-Panel: zusätzliche Messwerte (Spannung/Strom/SoC) je Knoten
  const isNodeHover = hover && !hover.includes("-");
  const ahoyCh = ahoy?.channels || [];
  const acV = avg(ahoyCh.map((c) => c.voltage));
  const acI = sumA(ahoyCh.map((c) => c.current));
  const mpptsArr = victron?.mppts || [];
  const dcV = avg(mpptsArr.map((m) => m.pv_voltage));
  const phasesArr = shelly?.phases || [];

  const buildDetail = (key) => {
    if (key === "pv") {
      const rows = [{ l: "Gesamt", v: `${round(pv)} W` }, { l: "AC Hoymiles", v: `${round(pvAc)} W` }];
      if (acV != null) rows.push({ l: "· Ø Spannung", v: `${f1(acV)} V` });
      if (acI != null) rows.push({ l: "· Σ Strom", v: `${f1(acI)} A` });
      rows.push({ l: "DC Victron", v: `${round(pvDc)} W` });
      if (dcV != null) rows.push({ l: "· Ø PV-Spannung", v: `${f1(dcV)} V` });
      if (!pvProducing && isNight) rows.push({ l: "Sonnenaufgang", v: `in ${sunriseStr}` });
      return { title: "PV-Block", color: COLOR.pv, rows };
    }
    if (key === "grid") {
      const rows = [{ l: "Σ Leistung", v: `${round(Math.abs(grid))} W` }, { l: "Status", v: gridLabel }];
      phasesArr.forEach((p) => rows.push({ l: p.phase, v: `${f1(p.voltage)} V · ${f1(p.current)} A` }));
      return { title: "Netz · Shelly 3EM", color: gridColor, rows };
    }
    if (key === "battery") {
      const kind = charge > discharge ? "Laden" : discharge > 0 ? "Entladen" : "Leerlauf";
      const rows = [{ l: "Ladezustand", v: `${round(soc)} %` }];
      if (trucki?.battery_voltage != null) rows.push({ l: "Spannung", v: `${f1(trucki.battery_voltage)} V` });
      rows.push({ l: "Leistung", v: `${round(Math.abs(battery))} W · ${kind}` });
      if (trucki?.temperature != null) rows.push({ l: "Temperatur", v: `${round(trucki.temperature)} °C` });
      rows.push({ l: "ZEPC", v: trucki?.zepc ? "EIN" : "AUS" });
      return { title: "Akku · Trucki/SUN", color: COLOR.battery, rows };
    }
    const rows = [
      { l: "Verbrauch", v: `${round(house)} W` },
      { l: "aus PV (AC)", v: `${round(pvAc)} W` },
      { l: "aus Akku", v: `${round(discharge)} W` },
      { l: "aus Netz", v: `${round(Math.max(0, grid))} W` },
    ];
    return { title: "Haus", color: COLOR.house, rows };
  };
  const detail = isNodeHover ? buildDetail(hover) : null;

  return (
    <div className="glass-strong h-full flex flex-col">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 flex items-center gap-2">
          <Activity size={12} className="text-cyan-400 neon-cyan" />
          Energiefluss · Live
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-white/55">
          <span className="hidden sm:inline text-white/40">Knoten/Pfad überfahren für Werte</span>
          <span className="inline-flex items-center gap-1.5 text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse text-emerald-400" /> AKTIV
          </span>
        </div>
      </div>
      <div className="p-4 flex-1 flex items-center relative">
        {detail && (
          <div className="absolute top-3 right-3 z-10 w-[210px] pointer-events-none" data-testid="flow-inspector">
            <div className="glass-strong rounded-md border px-3 py-2.5" style={{ borderColor: `${detail.color}66`, boxShadow: `0 0 16px ${detail.color}22` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: detail.color, boxShadow: `0 0 6px ${detail.color}` }} />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/80" data-testid="flow-inspector-title">{detail.title}</span>
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
        <svg viewBox="0 0 900 300" className="w-full" data-testid="energy-flow-svg" style={{ maxHeight: 520 }}>
          <defs>
            <pattern id="bggrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="efcenter" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="rgba(6,182,212,0.05)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="900" height="300" fill="url(#bggrid)" />
          <rect x="0" y="0" width="900" height="300" fill="url(#efcenter)" />

          {flows.map((f) => <Flow key={f.id} flow={f} hover={hover} onHover={setHover} />)}
          {nodes.map((n) => (
            <NodeCard key={n.key} node={n} dim={hover && !nodeKeys[n.key]?.includes(hover)} onHover={setHover} />
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
