/* Animated SVG energy flow diagram (PV / Haus / Netz / Akku) - dark glassmorphism */
import { Sun, Home, Cable, BatteryCharging, Activity } from "lucide-react";

const COLOR = {
  pv: "#FACC15",
  grid_import: "#F87171",
  grid_export: "#10B981",
  battery: "#06B6D4",
};

function Node({ x, y, w = 170, h = 96, label, value, unit, sub, color, Icon, testid, glow }) {
  return (
    <g data-testid={testid}>
      <defs>
        <filter id={`glow-${testid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Subtle outer glow */}
      <rect x={x - w / 2 - 2} y={y - h / 2 - 2} width={w + 4} height={h + 4} rx="8" fill="none"
            stroke={color} strokeWidth="1" opacity={glow ? "0.40" : "0.10"}
            filter={glow ? `url(#glow-${testid})` : undefined} />
      {/* Main glass card */}
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="6" fill="rgba(15,23,42,0.7)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {/* Color accent bar */}
      <rect x={x - w / 2} y={y - h / 2} width="4" height={h} rx="2" fill={color} opacity="0.85" />
      {/* Label row (icon would need <image>, we use SVG <foreignObject> only for the icon) */}
      <foreignObject x={x - w / 2 + 12} y={y - h / 2 + 8} width={20} height={20}>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <Icon size={14} color={color} strokeWidth={2.2} />
        </div>
      </foreignObject>
      <text x={x - w / 2 + 36} y={y - h / 2 + 21} fontSize="10" fontFamily="IBM Plex Mono"
            fontWeight="700" letterSpacing="1.6" fill="rgba(255,255,255,0.55)">
        {String(label).toUpperCase()}
      </text>
      {/* Value: rendered as SVG <text> so it never wraps */}
      <text x={x - w / 2 + 14} y={y + 8} fontSize="28" fontFamily="IBM Plex Mono"
            fontWeight="500" fill="#ffffff"
            style={glow ? { filter: `drop-shadow(0 0 6px ${color}99)` } : undefined}>
        {value}
        <tspan fontSize="13" fill="rgba(255,255,255,0.45)" dx="4">{unit}</tspan>
      </text>
      {sub && (
        <text x={x - w / 2 + 14} y={y + h / 2 - 10} fontSize="10" fontFamily="IBM Plex Mono"
              fill="rgba(255,255,255,0.55)">
          {sub}
        </text>
      )}
    </g>
  );
}

function Flow({ d, color, active, reverse, watts }) {
  if (!active) {
    return <path d={d} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" strokeDasharray="2 6" />;
  }
  return (
    <>
      {/* Outer halo */}
      <path d={d} stroke={color} strokeWidth="8" fill="none" opacity="0.15" strokeLinecap="round" />
      {/* Main line */}
      <path d={d} stroke={color} strokeWidth="3" fill="none" opacity="0.30" strokeLinecap="round" />
      {/* Animated dashes */}
      <path
        d={d}
        stroke={color}
        strokeWidth="3"
        fill="none"
        className={reverse ? "flow-line reverse" : "flow-line"}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}aa)` }}
      />
      {watts !== undefined && <FlowLabel d={d} color={color} reverse={reverse} />}
    </>
  );
}

function FlowLabel({ d, color, reverse }) {
  const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
  if (!m) return null;
  const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
  const x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Symbol statt Zahlenwert: Richtungspfeil auf der Linienmitte, zeigt die
  // tatsächliche Flussrichtung (Quelle → Ziel, bei reverse umgekehrt).
  const fromX = reverse ? x2 : x1, fromY = reverse ? y2 : y1;
  const toX = reverse ? x1 : x2, toY = reverse ? y1 : y2;
  const angle = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;
  return (
    <g>
      <circle cx={mx} cy={my} r="11" fill="rgba(15,23,42,0.92)" stroke={color} strokeWidth="1.5" />
      <path
        d="M -4 -5 L 6 0 L -4 5 Z"
        fill={color}
        transform={`translate(${mx},${my}) rotate(${angle})`}
        style={{ filter: `drop-shadow(0 0 3px ${color}cc)` }}
      />
    </g>
  );
}

export default function EnergyFlow({ summary, trucki }) {
  const pv = summary?.pv_power || 0;
  const grid = summary?.grid_power || 0;
  const battery = summary?.battery_power || 0;
  const house = summary?.house_power || 0;
  const soc = summary?.battery_soc || 0;

  const importActive = grid > 20;
  const exportActive = grid < -20;
  const pvActive = pv > 5;
  const batteryCharge = battery > 20;
  const batteryDischarge = battery < -20;
  const houseActive = house > 5;

  let gridLabel = "balanced";
  if (importActive) gridLabel = "Bezug";
  else if (exportActive) gridLabel = "Einspeisung";
  const gridColor = grid >= 0 ? COLOR.grid_import : COLOR.grid_export;
  let batteryMode = "idle";
  if (batteryCharge) batteryMode = "lädt";
  else if (batteryDischarge) batteryMode = "entlädt";

  // Akku-Sub-Text: ZEPC-Limit anzeigen wenn aktiv (Trucki im ZEPC-Modus)
  let batterySub = `${Math.round(soc)}% · ${batteryMode}`;
  if (trucki?.zepc && trucki?.ac_setpoint_w) {
    batterySub = `${Math.round(soc)}% · ZEPC ${Math.round(trucki.ac_setpoint_w)}W`;
  }

  return (
    <div className="glass-strong">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65 flex items-center gap-2">
          <Activity size={12} className="text-cyan-400 neon-cyan" />
          Energiefluss · Live
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-white/70">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse text-emerald-400" /> AKTIV
        </div>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 900 460" className="w-full" data-testid="energy-flow-svg" style={{ maxHeight: 500 }}>
          <defs>
            <pattern id="bggrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="900" height="460" fill="url(#bggrid)" />

          <Node x={450} y={70} label="PV-Anlage" value={Math.round(pv)} unit="W" color={COLOR.pv} Icon={Sun}
                testid="flow-pv" sub={pvActive ? "produziert" : "nachts / inaktiv"} glow={pvActive} />
          <Node x={450} y={260} label="Haus" value={Math.round(house)} unit="W" color="#cbd5e1" Icon={Home}
                testid="flow-house" sub={houseActive ? "Verbrauch" : "Standby"} glow={houseActive} />
          <Node x={130} y={260} label="Netz" value={Math.round(Math.abs(grid))} unit="W"
                color={gridColor} Icon={Cable} testid="flow-grid" sub={gridLabel} glow={importActive || exportActive} />
          <Node x={770} y={260} label="Akku" value={Math.round(Math.abs(battery))} unit="W"
                color={COLOR.battery} Icon={BatteryCharging} testid="flow-battery"
                sub={batterySub}
                glow={batteryCharge || batteryDischarge} />

          <Flow d="M 450 118 L 450 212" color={COLOR.pv} active={pvActive} watts={pvActive ? pv : undefined} />
          <Flow d="M 215 260 L 365 260" color={importActive ? COLOR.grid_import : COLOR.grid_export}
                active={importActive || exportActive} reverse={exportActive}
                watts={(importActive || exportActive) ? Math.abs(grid) : undefined} />
          <Flow d="M 535 260 L 685 260" color={COLOR.battery}
                active={batteryCharge || batteryDischarge} reverse={batteryDischarge}
                watts={(batteryCharge || batteryDischarge) ? Math.abs(battery) : undefined} />

          <Flow d="M 450 308 L 450 395" color="#cbd5e1" active={houseActive} />
          <g>
            <rect x={375} y={398} width={150} height={32} rx="4" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <text x={450} y={418} textAnchor="middle" fontSize="12" fontFamily="IBM Plex Mono" fontWeight="600" fill="#cbd5e1">
              {`${Math.round(Math.max(0, house))} W VERBRAUCH`}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
