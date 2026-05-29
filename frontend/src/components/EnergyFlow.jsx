/* Animated SVG energy flow diagram (PV / Haus / Netz / Akku) */
import { Sun, Home, Cable, BatteryCharging, Activity } from "lucide-react";

const COLOR = {
  pv: "#EAB308",
  grid_import: "#EF4444",
  grid_export: "#22C55E",
  battery: "#3B82F6",
};

function Node({ x, y, w = 150, h = 80, label, value, unit, sub, color, Icon, testid, accent }) {
  return (
    <g data-testid={testid}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="white" stroke="black" strokeWidth="1.5" />
      <rect x={x - w / 2} y={y - h / 2} width="5" height={h} fill={accent || color} />
      <foreignObject x={x - w / 2 + 8} y={y - h / 2 + 4} width={w - 12} height={h - 8}>
        <div xmlns="http://www.w3.org/1999/xhtml" className="h-full flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <Icon size={14} color={color} strokeWidth={2.2} />
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">{label}</div>
          </div>
          <div className="font-mono text-2xl font-medium leading-none mt-1 text-black">
            {value}
            <span className="text-[11px] ml-1 text-gray-500 font-normal">{unit}</span>
          </div>
          {sub && <div className="font-mono text-[10px] text-gray-500 mt-0.5">{sub}</div>}
        </div>
      </foreignObject>
    </g>
  );
}

function Flow({ d, color, active, reverse, watts }) {
  if (!active) {
    return <path d={d} stroke="#D1D5DB" strokeWidth="1.5" fill="none" strokeDasharray="2 6" />;
  }
  return (
    <>
      <path d={d} stroke={color} strokeWidth="3" fill="none" opacity="0.18" />
      <path
        d={d}
        stroke={color}
        strokeWidth="3"
        fill="none"
        className={reverse ? "flow-line reverse" : "flow-line"}
        strokeLinecap="round"
      />
      {watts !== undefined && (
        <FlowLabel d={d} color={color} watts={watts} />
      )}
    </>
  );
}

function FlowLabel({ d, color, watts }) {
  // Place label at the path midpoint - quick hack via getPointAtLength is not available without DOM ref.
  // Instead parse the simple "M x1 y1 L x2 y2" pattern.
  const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
  if (!m) return null;
  const x = (parseFloat(m[1]) + parseFloat(m[3])) / 2;
  const y = (parseFloat(m[2]) + parseFloat(m[4])) / 2;
  return (
    <g>
      <rect x={x - 38} y={y - 12} width="76" height="24" fill="white" stroke={color} strokeWidth="1.5" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontFamily="IBM Plex Mono" fill={color} fontWeight="700">
        {`${Math.round(Math.abs(watts))} W`}
      </text>
    </g>
  );
}

export default function EnergyFlow({ summary }) {
  const pv = summary?.pv_power || 0;
  const grid = summary?.grid_power || 0; // >0 import, <0 export
  const battery = summary?.battery_power || 0; // >0 charging
  const house = summary?.house_power || 0;
  const soc = summary?.battery_soc || 0;

  const importActive = grid > 20;
  const exportActive = grid < -20;
  const pvActive = pv > 5;
  const batteryCharge = battery > 20;
  const batteryDischarge = battery < -20;
  const houseActive = house > 5;

  // Helpers extracted to avoid nested ternaries inside JSX
  const gridLabel = importActive ? "Bezug" : exportActive ? "Einspeisung" : "balanced";
  const gridColor = grid >= 0 ? COLOR.grid_import : COLOR.grid_export;
  let batteryMode = "idle";
  if (batteryCharge) batteryMode = "lädt";
  else if (batteryDischarge) batteryMode = "entlädt";

  return (
    <div className="bg-white border border-black" style={{ borderLeftWidth: 6, borderLeftColor: "#000" }}>
      <div className="border-b border-black px-4 py-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600 flex items-center gap-2">
          <Activity size={12} />
          Energiefluss · Live
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="w-2 h-2 bg-green-500 dot-pulse" /> Aktiv
        </div>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 800 400" className="w-full" data-testid="energy-flow-svg" style={{ maxHeight: 420 }}>
          {/* Background grid for industrial look */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F3F4F6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="800" height="400" fill="url(#grid)" />

          {/* Nodes */}
          <Node x={400} y={60} label="PV-Anlage" value={Math.round(pv)} unit="W" color={COLOR.pv} Icon={Sun} testid="flow-pv"
                sub={pvActive ? "produziert" : "nachts"} accent={COLOR.pv} />
          <Node x={400} y={230} label="Haus" value={Math.round(house)} unit="W" color="#000" Icon={Home} testid="flow-house"
                sub={houseActive ? "Verbrauch" : "Standby"} accent="#000" />
          <Node x={140} y={230} label="Netz" value={Math.round(Math.abs(grid))} unit="W"
                color={gridColor}
                Icon={Cable} testid="flow-grid"
                sub={gridLabel}
                accent={gridColor} />
          <Node x={660} y={230} label="Akku" value={Math.round(Math.abs(battery))} unit="W"
                color={COLOR.battery}
                Icon={BatteryCharging} testid="flow-battery"
                sub={`${Math.round(soc)}% · ${batteryMode}`}
                accent={COLOR.battery} />

          {/* Flow lines */}
          <Flow d="M 400 100 L 400 190" color={COLOR.pv} active={pvActive} watts={pvActive ? pv : undefined} />
          <Flow d="M 215 230 L 325 230" color={importActive ? COLOR.grid_import : COLOR.grid_export}
                active={importActive || exportActive} reverse={exportActive}
                watts={(importActive || exportActive) ? Math.abs(grid) : undefined} />
          <Flow d="M 475 230 L 585 230" color={COLOR.battery}
                active={batteryCharge || batteryDischarge} reverse={batteryDischarge}
                watts={(batteryCharge || batteryDischarge) ? Math.abs(battery) : undefined} />

          {/* House → consumption arrow downward */}
          <Flow d="M 400 270 L 400 350" color="#000" active={houseActive} />
          <g>
            <rect x={340} y={355} width={120} height={28} fill="white" stroke="#000" strokeWidth="1" />
            <text x={400} y={373} textAnchor="middle" fontSize="11" fontFamily="IBM Plex Mono" fontWeight="600">
              {`${Math.round(Math.max(0, house))} W VERBRAUCH`}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
