import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sun, Zap, BatteryCharging, Home, Plug, Gauge } from "lucide-react";
import { COLOR } from "../components/solar-ui";

// Reine Design-Vorschau (keine Live-Daten) der SCADAvis-/Synoptik-Mimik,
// wie sie als Grafana-Panel (scadavis-synoptic-panel) bzw. im App-Dashboard
// aussehen könnte: SVG-Synoptik mit animiertem Energiefluss im SCADA-Dark-Look.

const VB_W = 1000;
const VB_H = 520;

// Demo-Szenario: sonniger Tag, Überschuss lädt Akku + speist ein.
const SCENARIOS = {
  tag: {
    label: "Tag · Überschuss",
    nodes: {
      mppt1: 1486,
      mppt2: 1612,
      hoymiles: 1392,
      battery: 1240, // Ladung (+)
      house: 1860,
      grid: 1390, // Einspeisung
    },
    gridExport: true,
    batteryCharging: true,
  },
  abend: {
    label: "Abend · Bezug",
    nodes: {
      mppt1: 120,
      mppt2: 95,
      hoymiles: 60,
      battery: -640, // Entladung (-)
      house: 1120,
      grid: 205, // Bezug
    },
    gridExport: false,
    batteryCharging: false,
  },
};

const fmt = (w) => new Intl.NumberFormat("de-DE").format(Math.abs(Math.round(w)));

// Geometrie der Knoten (Box oben-links + Breite/Höhe)
const BOX_W = 210;
const BOX_H = 92;
const LEFT_X = 44;
const CENTER_X = 395;
const CENTER_W = 210;
const RIGHT_X = 746;

const SRC = {
  mppt1: { y: 48, color: "#F59E0B", icon: Sun, title: "Victron MPPT 1", sub: "4× 425 Wp" },
  mppt2: { y: 206, color: "#F59E0B", icon: Sun, title: "Victron MPPT 2", sub: "4× 445 Wp" },
  hoymiles: { y: 364, color: COLOR.pv, icon: Zap, title: "Hoymiles HM1500", sub: "AC-Wechselrichter" },
};
const SINK = {
  battery: { y: 48, color: COLOR.battery, icon: BatteryCharging, title: "Speicher", sub: "Trucki2Shelly" },
  house: { y: 206, color: COLOR.house, icon: Home, title: "Hausverbrauch", sub: "Shelly Pro 3EM" },
  grid: { y: 364, color: COLOR.grid_exp, icon: Plug, title: "Netz", sub: "Shelly Pro 3EM" },
};

const cy = (yTop) => yTop + BOX_H / 2;
const CEN_Y = 206 + BOX_H / 2; // zentriertes Kopplungsmodul

// Pfad von rechter Boxkante zur linken Kante des Kopplungsmoduls (Quelle→Mitte)
const srcPath = (yTop) => {
  const x1 = LEFT_X + BOX_W;
  const y1 = cy(yTop);
  const x2 = CENTER_X;
  const y2 = CEN_Y;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};
// Pfad von rechter Kante Kopplungsmodul zur linken Boxkante (Mitte→Senke)
const sinkPath = (yTop) => {
  const x1 = CENTER_X + CENTER_W;
  const y1 = CEN_Y;
  const x2 = RIGHT_X;
  const y2 = cy(yTop);
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

function FlowWire({ id, d, color, active, reverse }) {
  const dim = !active;
  return (
    <g opacity={dim ? 0.25 : 1}>
      <path id={id} d={d} fill="none" stroke={color} strokeWidth={active ? 3 : 1.6}
        strokeLinecap="round" style={{ filter: active ? `drop-shadow(0 0 6px ${color})` : "none" }} opacity={0.5} />
      {active && [0, 1, 2].map((i) => (
        <circle key={i} r={4.5} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
          <animateMotion dur="2.6s" begin={`${i * 0.86}s`} repeatCount="indefinite"
            keyPoints={reverse ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      ))}
    </g>
  );
}

function Node({ x, y, color, icon: Icon, title, sub, value, unit, signLabel }) {
  return (
    <foreignObject x={x} y={y} width={BOX_W} height={BOX_H}>
      <div
        className="w-full h-full rounded-xl px-3.5 py-2.5 flex flex-col justify-between"
        style={{
          background: "linear-gradient(145deg, #0c1526 0%, #070c18 100%)",
          border: `1px solid ${color}55`,
          boxShadow: `inset 0 1px 0 rgba(226,232,240,0.06), 0 0 0 1px rgba(2,6,14,0.6), 0 18px 40px -26px #000, 0 0 22px -8px ${color}`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid place-items-center rounded-md shrink-0"
            style={{ width: 24, height: 24, background: `${color}1f`, border: `1px solid ${color}55` }}>
            <Icon size={14} color={color} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white/90 leading-tight truncate">{title}</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/40 truncate">{sub}</div>
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          {signLabel && (
            <span className="text-[8px] uppercase tracking-[0.12em] px-1 py-0.5 rounded"
              style={{ color, background: `${color}1a`, border: `1px solid ${color}44` }}>{signLabel}</span>
          )}
          <span className="font-dseg text-[1.3rem] leading-none" style={{ color, textShadow: `0 0 10px ${color}88` }}>
            {value}
          </span>
          <span className="font-mono text-[10px] text-white/40">{unit}</span>
        </div>
      </div>
    </foreignObject>
  );
}

export default function ScadavisPreview() {
  const [scn, setScn] = useState("tag");
  const s = SCENARIOS[scn];
  const n = s.nodes;
  const gridColor = s.gridExport ? COLOR.grid_exp : COLOR.grid_imp;
  const battColor = s.batteryCharging ? COLOR.battery : COLOR.grid_imp;
  const pvTotal = n.mppt1 + n.mppt2 + n.hoymiles;

  return (
    <div className="min-h-screen px-5 sm:px-8 py-8 max-w-[1400px] mx-auto" data-testid="scadavis-preview-page">
      <div>
        <Link to="/" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200 transition-colors" data-testid="scadavis-back">
          <ArrowLeft size={13} /> Zurück zum Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-3 flex items-center gap-3">
          <span className="w-1.5 h-7 rounded-sm" style={{ background: COLOR.battery, boxShadow: `0 0 10px ${COLOR.battery}aa` }} />
          SCADAvis · Synoptik · Vorschau
        </h1>
        <p className="text-white/55 text-sm mt-1.5 max-w-2xl">
          Design-Vorschau (keine Live-Daten). So könnte die Synoptik/Energiefluss-Mimik als SCADAvis-Panel
          aussehen – Quellen links, DC/AC-Kopplung in der Mitte, Verbraucher/Speicher/Netz rechts, mit
          animiertem Leistungsfluss im SCADA-Dark-Look.
        </p>
      </div>

      {/* Szenario-Umschalter */}
      <div className="flex flex-wrap items-center gap-2 mt-5 mb-4">
        {Object.entries(SCENARIOS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setScn(k)}
            data-testid={`scadavis-scn-${k}`}
            className={`px-4 py-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors ${scn === k ? "bg-cyan-400/20 text-cyan-200 border-cyan-400/40" : "text-white/55 border-white/12 hover:text-white hover:bg-white/5"}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden"
        style={{ background: "radial-gradient(1200px 600px at 50% 0%, #0b1424 0%, #05080f 70%)", border: "1px solid rgba(148,163,184,0.14)" }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto block" data-testid="scadavis-svg" role="img" aria-label="Energiefluss-Synoptik">
          <defs>
            <pattern id="scada-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#scada-grid)" />

          {/* Wires Quelle -> Mitte */}
          <FlowWire id="w-mppt1" d={srcPath(SRC.mppt1.y)} color={SRC.mppt1.color} active={n.mppt1 > 20} />
          <FlowWire id="w-mppt2" d={srcPath(SRC.mppt2.y)} color={SRC.mppt2.color} active={n.mppt2 > 20} />
          <FlowWire id="w-hoymiles" d={srcPath(SRC.hoymiles.y)} color={SRC.hoymiles.color} active={n.hoymiles > 20} />

          {/* Wires Mitte -> Senke */}
          <FlowWire id="w-battery" d={sinkPath(SINK.battery.y)} color={battColor} active={Math.abs(n.battery) > 20} reverse={!s.batteryCharging} />
          <FlowWire id="w-house" d={sinkPath(SINK.house.y)} color={SINK.house.color} active={n.house > 20} />
          <FlowWire id="w-grid" d={sinkPath(SINK.grid.y)} color={gridColor} active={n.grid > 20} reverse={!s.gridExport} />

          {/* Quellen */}
          <Node x={LEFT_X} y={SRC.mppt1.y} color={SRC.mppt1.color} icon={SRC.mppt1.icon} title={SRC.mppt1.title} sub={SRC.mppt1.sub} value={fmt(n.mppt1)} unit="W" />
          <Node x={LEFT_X} y={SRC.mppt2.y} color={SRC.mppt2.color} icon={SRC.mppt2.icon} title={SRC.mppt2.title} sub={SRC.mppt2.sub} value={fmt(n.mppt2)} unit="W" />
          <Node x={LEFT_X} y={SRC.hoymiles.y} color={SRC.hoymiles.color} icon={SRC.hoymiles.icon} title={SRC.hoymiles.title} sub={SRC.hoymiles.sub} value={fmt(n.hoymiles)} unit="W" />

          {/* Zentrales Kopplungsmodul */}
          <foreignObject x={CENTER_X} y={206} width={CENTER_W} height={BOX_H}>
            <div className="w-full h-full rounded-xl px-3.5 py-2.5 flex flex-col justify-between"
              style={{
                background: "linear-gradient(145deg, #10233a 0%, #081220 100%)",
                border: "1px solid rgba(6,182,212,0.5)",
                boxShadow: "inset 0 1px 0 rgba(226,232,240,0.08), 0 0 28px -6px rgba(6,182,212,0.55)",
              }}>
              <div className="flex items-center gap-2">
                <span className="grid place-items-center rounded-md" style={{ width: 24, height: 24, background: "rgba(6,182,212,0.14)", border: "1px solid rgba(6,182,212,0.5)" }}>
                  <Gauge size={14} color={COLOR.battery} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white/90 leading-tight">DC/AC-Kopplung</div>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-white/40">Erzeugung gesamt</div>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-dseg text-[1.3rem] leading-none" style={{ color: COLOR.pv, textShadow: `0 0 10px ${COLOR.pv}88` }}>{fmt(pvTotal)}</span>
                <span className="font-mono text-[10px] text-white/40">W PV</span>
              </div>
            </div>
          </foreignObject>

          {/* Senken */}
          <Node x={RIGHT_X} y={SINK.battery.y} color={battColor} icon={SINK.battery.icon} title={SINK.battery.title} sub={SINK.battery.sub} value={fmt(n.battery)} unit="W" signLabel={s.batteryCharging ? "Laden" : "Entladen"} />
          <Node x={RIGHT_X} y={SINK.house.y} color={SINK.house.color} icon={SINK.house.icon} title={SINK.house.title} sub={SINK.house.sub} value={fmt(n.house)} unit="W" />
          <Node x={RIGHT_X} y={SINK.grid.y} color={gridColor} icon={SINK.grid.icon} title={SINK.grid.title} sub={SINK.grid.sub} value={fmt(n.grid)} unit="W" signLabel={s.gridExport ? "Einspeisung" : "Bezug"} />
        </svg>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 font-mono text-[11px] text-white/55">
        {[
          ["PV / MPPT", "#F59E0B"],
          ["Hoymiles", COLOR.pv],
          ["Speicher", COLOR.battery],
          ["Haus", COLOR.house],
          ["Einspeisung", COLOR.grid_exp],
          ["Bezug", COLOR.grid_imp],
        ].map(([l, c]) => (
          <span key={l} className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c, boxShadow: `0 0 8px ${c}aa` }} />
            {l}
          </span>
        ))}
      </div>
      <p className="font-mono text-[11px] text-white/40 mt-4 max-w-2xl">
        Hinweis: Dies ist die App-Vorschau des Konzepts. In Grafana entspricht das dem Plugin
        <span className="text-cyan-300"> scadavis-synoptic-panel</span> (eigenes SVG + Werte-Bindings an die
        InfluxDB-Felder). Sag mir, ob die Darstellung so passt – dann hänge ich das Panel ins Dashboard ein.
      </p>

      <div className="h-12" />
    </div>
  );
}
