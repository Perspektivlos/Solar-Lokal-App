/* Animated SVG energy flow diagram (PV / Haus / Netz / Akku) - dark glassmorphism */
import { Sun, Home, Cable, BatteryCharging, Activity } from "lucide-react";

const COLOR = {
  pv: "#FACC15",
  grid_import: "#F87171",
  grid_export: "#10B981",
  battery: "#06B6D4",
};

function Node({ x, y, w = 158, h = 86, label, value, unit, sub, color, Icon, testid, glow }) {
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
            stroke={color} strokeWidth="1" opacity={glow ? "0.35" : "0.10"}
            filter={glow ? `url(#glow-${testid})` : undefined} />
      {/* Main glass card */}
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="6" fill="rgba(15,23,42,0.6)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {/* Color accent bar */}
      <rect x={x - w / 2} y={y - h / 2} width="4" height={h} rx="2" fill={color} opacity="0.85" />
      <foreignObject x={x - w / 2 + 12} y={y - h / 2 + 6} width={w - 16} height={h - 12}>
        <div xmlns="http://www.w3.org/1999/xhtml" className="h-full flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <Icon size={13} color={color} strokeWidth={2.2} />
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">{label}</div>
          </div>
          <div className="font-mono text-2xl font-medium leading-none mt-1.5 text-white">
            {value}
            <span className="text-[11px] ml-1 text-white/45 font-normal">{unit}</span>
          </div>
          {sub && <div className="font-mono text-[10px] text-white/55 mt-0.5">{sub}</div>}
        </div>
      </foreignObject>
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
      {watts !== undefined && <FlowLabel d={d} color={color} watts={watts} />}
    </>
  );
}

function FlowLabel({ d, color, watts }) {
  const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
  if (!m) return null;
  const x = (parseFloat(m[1]) + parseFloat(m[3])) / 2;
  const y = (parseFloat(m[2]) + parseFloat(m[4])) / 2;
  return (
    <g>
      <rect x={x - 40} y={y - 13} width="80" height="26" rx="4" fill="rgba(15,23,42,0.92)" stroke={color} strokeWidth="1.5" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontFamily="IBM Plex Mono" fill={color} fontWeight="700"
            style={{ filter: `drop-shadow(0 0 3px ${color}99)` }}>
        {`${Math.round(Math.abs(watts))} W`}
      </text>
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

  const gridLabel = importActive ? "Bezug" : exportActive ? "Einspeisung" : "balanced";
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
        <svg viewBox="0 0 800 400" className="w-full" data-testid="energy-flow-svg" style={{ maxHeight: 440 }}>
          <defs>
            <pattern id="bggrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="800" height="400" fill="url(#bggrid)" />

          <Node x={400} y={60} label="PV-Anlage" value={Math.round(pv)} unit="W" color={COLOR.pv} Icon={Sun}
                testid="flow-pv" sub={pvActive ? "produziert" : "nachts / inaktiv"} glow={pvActive} />
          <Node x={400} y={230} label="Haus" value={Math.round(house)} unit="W" color="#cbd5e1" Icon={Home}
                testid="flow-house" sub={houseActive ? "Verbrauch" : "Standby"} glow={houseActive} />
          <Node x={140} y={230} label="Netz" value={Math.round(Math.abs(grid))} unit="W"
                color={gridColor} Icon={Cable} testid="flow-grid" sub={gridLabel} glow={importActive || exportActive} />
          <Node x={660} y={230} label="Akku" value={Math.round(Math.abs(battery))} unit="W"
                color={COLOR.battery} Icon={BatteryCharging} testid="flow-battery"
                sub={batterySub}
                glow={batteryCharge || batteryDischarge} />

          <Flow d="M 400 103 L 400 187" color={COLOR.pv} active={pvActive} watts={pvActive ? pv : undefined} />
          <Flow d="M 219 230 L 321 230" color={importActive ? COLOR.grid_import : COLOR.grid_export}
                active={importActive || exportActive} reverse={exportActive}
                watts={(importActive || exportActive) ? Math.abs(grid) : undefined} />
          <Flow d="M 479 230 L 581 230" color={COLOR.battery}
                active={batteryCharge || batteryDischarge} reverse={batteryDischarge}
                watts={(batteryCharge || batteryDischarge) ? Math.abs(battery) : undefined} />

          <Flow d="M 400 273 L 400 345" color="#cbd5e1" active={houseActive} />
          <g>
            <rect x={335} y={350} width={130} height={28} rx="4" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <text x={400} y={368} textAnchor="middle" fontSize="11" fontFamily="IBM Plex Mono" fontWeight="600" fill="#cbd5e1">
              {`${Math.round(Math.max(0, house))} W VERBRAUCH`}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
