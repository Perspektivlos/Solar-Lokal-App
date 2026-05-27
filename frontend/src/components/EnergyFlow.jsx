/* Animated SVG energy flow diagram (PV / Haus / Netz / Akku) */
import { Sun, Home, Cable, BatteryCharging } from "lucide-react";

const COLOR = {
  pv: "#EAB308",
  grid_import: "#EF4444",
  grid_export: "#22C55E",
  battery: "#3B82F6",
  battery_discharge: "#3B82F6",
};

function Node({ x, y, label, value, unit, color, Icon, testid }) {
  return (
    <g data-testid={testid}>
      <rect x={x - 70} y={y - 36} width="140" height="72" fill="white" stroke="black" strokeWidth="1.5" />
      <foreignObject x={x - 66} y={y - 32} width="132" height="64">
        <div xmlns="http://www.w3.org/1999/xhtml" className="h-full flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5">
            <Icon size={14} color={color} strokeWidth={2} />
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">{label}</div>
          </div>
          <div className="font-mono text-lg font-medium leading-none mt-1 text-black">
            {value}
            <span className="text-[10px] ml-1 text-gray-600">{unit}</span>
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

function Flow({ d, color, active, reverse }) {
  if (!active) {
    return <path d={d} stroke="#D1D5DB" strokeWidth="1.5" fill="none" strokeDasharray="2 4" />;
  }
  return (
    <>
      <path d={d} stroke={color} strokeWidth="2" fill="none" opacity="0.25" />
      <path d={d} stroke={color} strokeWidth="2.5" fill="none" className={reverse ? "flow-line reverse" : "flow-line"} />
    </>
  );
}

export default function EnergyFlow({ summary }) {
  const pv = summary?.pv_power || 0;
  const grid = summary?.grid_power || 0; // >0 import
  const battery = summary?.battery_power || 0; // >0 charging
  const house = summary?.house_power || 0;

  const importActive = grid > 20;
  const exportActive = grid < -20;
  const pvActive = pv > 5;
  const batteryCharge = battery > 20;
  const batteryDischarge = battery < -20;
  const houseActive = house > 5;

  return (
    <div className="border border-black bg-white">
      <div className="border-b border-black px-4 py-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Energiefluss · Live</div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="w-2 h-2 bg-green-500 dot-pulse" /> AKTIV
        </div>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 760 360" className="w-full" data-testid="energy-flow-svg">
          {/* Top: PV */}
          <Node x={380} y={50} label="PV-Anlage" value={pv.toFixed(0)} unit="W" color={COLOR.pv} Icon={Sun} testid="flow-pv" />
          {/* Center: Haus */}
          <Node x={380} y={200} label="Haus" value={house.toFixed(0)} unit="W" color="#000" Icon={Home} testid="flow-house" />
          {/* Left: Netz */}
          <Node
            x={120}
            y={200}
            label="Netz"
            value={Math.abs(grid).toFixed(0)}
            unit={grid >= 0 ? "W BEZUG" : "W EINSP."}
            color={grid >= 0 ? COLOR.grid_import : COLOR.grid_export}
            Icon={Cable}
            testid="flow-grid"
          />
          {/* Right: Akku */}
          <Node
            x={640}
            y={200}
            label="Akku"
            value={Math.abs(battery).toFixed(0)}
            unit={`W · ${(summary?.battery_soc || 0).toFixed(0)}%`}
            color={COLOR.battery}
            Icon={BatteryCharging}
            testid="flow-battery"
          />
          {/* Flows */}
          {/* PV → Haus */}
          <Flow d="M 380 86 L 380 164" color={COLOR.pv} active={pvActive} />
          {/* Netz → Haus (import) / Haus → Netz (export) */}
          <Flow d="M 190 200 L 310 200" color={importActive ? COLOR.grid_import : COLOR.grid_export} active={importActive || exportActive} reverse={exportActive} />
          {/* Haus ↔ Akku */}
          <Flow d="M 450 200 L 570 200" color={COLOR.battery} active={batteryCharge || batteryDischarge} reverse={batteryDischarge} />

          {/* House → consumption indicator */}
          <Flow d="M 380 236 L 380 320" color="#000" active={houseActive} />
          <text x={380} y={340} textAnchor="middle" className="font-mono" fontSize="10" fill="#374151">
            VERBRAUCH
          </text>
        </svg>
      </div>
    </div>
  );
}
