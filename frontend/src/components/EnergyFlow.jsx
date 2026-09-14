/* Animated SVG Sci-Fi HUD Energy Flow Matrix (PV / Haus / Netz / Akku / Central Core) */
import React from "react";
import { Sun, Home, Cable, BatteryCharging, Zap, Cpu, ShieldAlert, Activity } from "lucide-react";

const COLOR = {
  pv: "#FACC15",         // Neon Gold/Yellow
  grid_import: "#EF4444",// Cyber Red
  grid_export: "#10B981",// Emerald Matrix Green
  battery: "#06B6D4",    // Cyan Plasma
  house: "#38BDF8",      // Sky Blue / High Voltage Silver
  core: "#6366F1",       // Indigo Core Matrix
};

// Flow-Geschwindigkeit basierend auf Wattleistung: 0W ≈ 3.0s (inaktiv/langsam) … ≥3000W ≈ 0.5s (hyperspeed)
function flowDurSec(watts) {
  const w = Math.min(Math.max(watts || 0, 0), 4000);
  const t = w / 4000;
  return +(2.6 - t * 2.1).toFixed(2);
}

// Straight-line path "M x1 y1 L x2 y2" umkehren für reverse-Fluss
function reversePath(d) {
  const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
  if (!m) return d;
  return `M ${m[3]} ${m[4]} L ${m[1]} ${m[2]}`;
}

// Cyber HUD Node Card
function SciFiNode({ x, y, w = 180, h = 100, label, value, unit, sub, color, Icon, testid, glow, badgeText, percent }) {
  const halfW = w / 2;
  const halfH = h / 2;

  // Cut-corner chamfer path for futuristic frame
  const chamfer = 12;
  const nodePath = `
    M ${x - halfW + chamfer} ${y - halfH}
    L ${x + halfW - chamfer} ${y - halfH}
    L ${x + halfW} ${y - halfH + chamfer}
    L ${x + halfW} ${y + halfH - chamfer}
    L ${x + halfW - chamfer} ${y + halfH}
    L ${x - halfW + chamfer} ${y + halfH}
    L ${x - halfW} ${y + halfH - chamfer}
    L ${x - halfW} ${y - halfH + chamfer}
    Z
  `;

  return (
    <g data-testid={testid} className="select-none">
      {/* Dynamic Glow Aura */}
      {glow && (
        <path
          d={nodePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          opacity="0.35"
          filter={`url(#glow-heavy-${testid})`}
        />
      )}

      {/* Main Dark Cyber Glass Background */}
      <path
        d={nodePath}
        fill="rgba(8, 14, 28, 0.88)"
        stroke="rgba(255, 255, 255, 0.12)"
        strokeWidth="1.2"
      />

      {/* Outer Neon Edge Border Accent */}
      <path
        d={nodePath}
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity={glow ? "0.85" : "0.3"}
      />

      {/* Corner Bracket Tech Lines */}
      <path
        d={`M ${x - halfW + 4} ${y - halfH + 12} L ${x - halfW + 4} ${y - halfH + 4} L ${x - halfW + 12} ${y - halfH + 4}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.9"
      />
      <path
        d={`M ${x + halfW - 4} ${y - halfH + 12} L ${x + halfW - 4} ${y - halfH + 4} L ${x + halfW - 12} ${y - halfH + 4}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.9"
      />
      <path
        d={`M ${x - halfW + 4} ${y + halfH - 12} L ${x - halfW + 4} ${y + halfH - 4} L ${x - halfW + 12} ${y + halfH - 4}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.9"
      />
      <path
        d={`M ${x + halfW - 4} ${y + halfH - 12} L ${x + halfW - 4} ${y + halfH - 4} L ${x + halfW - 12} ${y + halfH - 4}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.9"
      />

      {/* Side Status Indicator Light */}
      <rect
        x={x - halfW + 2}
        y={y - halfH + 16}
        width="3"
        height={h - 32}
        rx="1.5"
        fill={color}
        opacity={glow ? "0.95" : "0.4"}
      />

      {/* Header Row: Icon & Monospaced Label */}
      <foreignObject x={x - halfW + 14} y={y - halfH + 10} width={22} height={22}>
        <div xmlns="http://www.w3.org/1999/xhtml" className="flex items-center justify-center">
          <Icon size={16} color={color} strokeWidth={2.4} />
        </div>
      </foreignObject>

      <text
        x={x - halfW + 42}
        y={y - halfH + 24}
        fontSize="10"
        fontFamily="Chakra Petch, JetBrains Mono, sans-serif"
        fontWeight="700"
        letterSpacing="2"
        fill="rgba(241, 245, 249, 0.9)"
      >
        {String(label).toUpperCase()}
      </text>

      {/* Optional Status Badge (e.g. SOC % or MODE) */}
      {badgeText && (
        <g>
          <rect
            x={x + halfW - 52}
            y={y - halfH + 10}
            width="42"
            height="14"
            rx="3"
            fill="rgba(15, 23, 42, 0.9)"
            stroke={color}
            strokeWidth="0.8"
          />
          <text
            x={x + halfW - 31}
            y={y - halfH + 20}
            fontSize="8"
            fontFamily="JetBrains Mono"
            fontWeight="700"
            textAnchor="middle"
            fill={color}
          >
            {badgeText}
          </text>
        </g>
      )}

      {/* Central Telemetry Value */}
      <text
        x={x - halfW + 16}
        y={y + 12}
        fontSize="26"
        fontFamily="JetBrains Mono"
        fontWeight="700"
        fill="#FFFFFF"
        style={glow ? { filter: `drop-shadow(0 0 8px ${color}CC)` } : undefined}
      >
        {value}
        <tspan fontSize="12" fill="rgba(255,255,255,0.5)" dx="4">
          {unit}
        </tspan>
      </text>

      {/* Progress Bar (if percent is provided, e.g. Battery SOC) */}
      {percent !== undefined && (
        <g>
          <rect
            x={x - halfW + 16}
            y={y + 20}
            width={w - 32}
            height="4"
            rx="2"
            fill="rgba(255,255,255,0.1)"
          />
          <rect
            x={x - halfW + 16}
            y={y + 20}
            width={Math.max(0, Math.min(w - 32, ((w - 32) * percent) / 100))}
            height="4"
            rx="2"
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </g>
      )}

      {/* Subtext Detail Line */}
      {sub && (
        <text
          x={x - halfW + 16}
          y={y + halfH - 12}
          fontSize="9.5"
          fontFamily="JetBrains Mono"
          fill="rgba(226, 232, 240, 0.65)"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

// Sci-Fi Conduit / Laser Energy Stream Component
function SciFiConduit({ d, color, active, reverse, watts, testid }) {
  if (!active) {
    return (
      <g data-testid={testid}>
        {/* Base Inactive Grid Path */}
        <path
          d={d}
          stroke="rgba(148, 163, 184, 0.15)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 6"
        />
      </g>
    );
  }

  const dur = flowDurSec(watts);

  return (
    <g data-testid={testid}>
      {/* Outer Sci-Fi Plasma Halo Glow */}
      <path
        d={d}
        stroke={color}
        strokeWidth="9"
        fill="none"
        opacity="0.14"
        strokeLinecap="round"
      />

      {/* Mid Conduit High-Voltage Wire */}
      <path
        d={d}
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />

      {/* Inner Glowing Core Laser Beam */}
      <path
        d={d}
        stroke="#FFFFFF"
        strokeWidth="1"
        fill="none"
        opacity="0.8"
      />

      {/* High-Frequency Flow Particle Stream */}
      <path
        d={d}
        stroke={color}
        strokeWidth="4"
        fill="none"
        className={reverse ? "scifi-flow-particles reverse" : "scifi-flow-particles"}
        strokeLinecap="round"
        style={{
          animationDuration: `${dur}s`,
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
      />

      {/* Traveling Energy Plasma Core Pulse Bullets */}
      <SciFiEnergyPulses d={d} color={color} reverse={reverse} dur={dur} />
    </g>
  );
}

// Traveling Plasma Bullet Pulse Markers along Path
function SciFiEnergyPulses({ d, color, reverse, dur }) {
  const path = reverse ? reversePath(d) : d;
  const markers = [0, -dur / 3, (-2 * dur) / 3];

  return (
    <>
      {markers.map((begin, i) => (
        <g key={i} style={{ filter: `drop-shadow(0 0 7px ${color})` }}>
          <animateMotion
            dur={`${dur}s`}
            begin={`${begin}s`}
            repeatCount="indefinite"
            rotate="auto"
            calcMode="linear"
            path={path}
          />
          {/* Plasma Orb Core */}
          <circle r="4" fill="#FFFFFF" />
          <circle r="7" fill={color} opacity="0.6" />
          {/* Directional Cyber Arrow head */}
          <polygon points="-4,-4 5,0 -4,4" fill={color} />
        </g>
      ))}
    </>
  );
}

// Central Energy Inverter Hub / Sci-Fi Router Core
function CentralPowerCore({ x = 450, y = 185, totalPower }) {
  const isHighPower = totalPower > 500;
  const coreColor = isHighPower ? "#06B6D4" : "#64748B";

  return (
    <g data-testid="energy-core-hub" className="select-none">
      {/* Pulse Rings */}
      <circle
        cx={x}
        cy={y}
        r="36"
        fill="none"
        stroke={coreColor}
        strokeWidth="1"
        opacity="0.3"
        strokeDasharray="4 4"
        className="animate-spin"
        style={{ transformOrigin: `${x}px ${y}px`, animationDuration: "18s" }}
      />
      <circle
        cx={x}
        cy={y}
        r="28"
        fill="none"
        stroke={coreColor}
        strokeWidth="1.5"
        opacity="0.5"
        strokeDasharray="8 4"
        className="animate-spin"
        style={{ transformOrigin: `${x}px ${y}px`, animationDuration: "10s", animationDirection: "reverse" }}
      />

      {/* Outer Core Sphere */}
      <circle
        cx={x}
        cy={y}
        r="22"
        fill="rgba(10, 16, 30, 0.95)"
        stroke={coreColor}
        strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 10px ${coreColor})` }}
      />

      {/* Inner Glowing Reactor Matrix */}
      <circle
        cx={x}
        cy={y}
        r="12"
        fill={coreColor}
        opacity="0.85"
        className="dot-pulse"
      />

      {/* Core Icon */}
      <foreignObject x={x - 10} y={y - 10} width={20} height={20}>
        <div xmlns="http://www.w3.org/1999/xhtml" className="flex items-center justify-center h-full">
          <Zap size={14} color="#FFFFFF" strokeWidth={2.8} />
        </div>
      </foreignObject>

      {/* Central Matrix Label */}
      <rect
        x={x - 40}
        y={y + 28}
        width="80"
        height="16"
        rx="4"
        fill="rgba(4, 6, 12, 0.85)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.8"
      />
      <text
        x={x}
        y={y + 39}
        fontSize="8.5"
        fontFamily="Chakra Petch, JetBrains Mono"
        fontWeight="700"
        letterSpacing="1.2"
        textAnchor="middle"
        fill="#94A3B8"
      >
        POWER ROUTER
      </text>
    </g>
  );
}

export default function EnergyFlow({ summary, trucki }) {
  const pv = summary?.pv_power || 0;            // Gesamt-PV-Erzeugung
  const pvAc = summary?.pv_ac_power ?? pv;      // Hoymiles AC → Haus
  const pvDc = summary?.pv_dc_power || 0;       // Victron MPPT → Akku (laden)
  const grid = summary?.grid_power || 0;
  const battery = summary?.battery_power || 0;  // Netto: + lädt, − entlädt
  const charge = summary?.battery_charge_w || 0;       // MPPT-Ladung (DC)
  const discharge = summary?.battery_discharge_w || 0; // SUN-Entladung → Haus
  const house = summary?.house_power || 0;
  const soc = summary?.battery_soc || 0;

  const importActive = grid > 20;
  const exportActive = grid < -20;
  const pvAcActive = pvAc > 5;
  const chargeActive = charge > 20;
  const dischargeActive = discharge > 20;
  const houseActive = house > 5;
  const pvProducing = pv > 5;

  let gridLabel = "NETZ-BALANCE";
  if (importActive) gridLabel = "NETZ-BEZUG";
  else if (exportActive) gridLabel = "EINSPEISUNG";
  const gridColor = grid >= 0 ? COLOR.grid_import : COLOR.grid_export;

  let batteryMode = "STANDBY";
  if (battery > 20) batteryMode = "LÄDT";
  else if (battery < -20) batteryMode = "ENTLÄDT";

  // Akku-Subtext
  let batterySub = `↑ ${Math.round(charge)}W  ↓ ${Math.round(discharge)}W`;
  if (trucki?.zepc && trucki?.ac_setpoint_w) {
    batterySub = `ZEPC LIMIT: ${Math.round(trucki.ac_setpoint_w)}W`;
  }

  const totalGridAbs = Math.abs(grid);
  const totalBatteryAbs = Math.abs(battery);
  const totalFlowingPower = pv + house + totalGridAbs + totalBatteryAbs;

  return (
    <div className="glass-strong h-full flex flex-col relative overflow-hidden rounded-xl border border-slate-700/50 shadow-2xl">
      {/* Sci-Fi Panel Header Strip */}
      <div className="border-b border-slate-700/40 bg-gradient-to-r from-slate-900/90 via-slate-800/80 to-slate-900/90 px-4 py-2.5 flex items-center justify-between">
        <div className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-slate-200 flex items-center gap-2">
          <Activity size={13} className="text-cyan-400 neon-cyan animate-pulse" />
          <span>Sci-Fi Energy Matrix · Live Flow</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse" />
            <span>CORE ONLINE</span>
          </div>
          <span className="text-slate-400 hidden sm:inline">
            FLOW: <strong className="text-slate-200">{Math.round(totalFlowingPower)} W</strong>
          </span>
        </div>
      </div>

      {/* Main SVG Energy Canvas */}
      <div className="p-3 sm:p-4 flex-1 flex items-center justify-center bg-[#040711] relative">
        <svg
          viewBox="0 0 900 370"
          className="w-full h-auto max-h-[520px]"
          data-testid="energy-flow-svg"
        >
          <defs>
            {/* Cyber HUD Grid Background Pattern */}
            <pattern id="scifi-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="0.8" />
              <circle cx="40" cy="40" r="1" fill="rgba(255,255,255,0.08)" />
            </pattern>

            {/* Neon Glow Filters */}
            <filter id="glow-heavy-flow-pv" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-heavy-flow-house" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-heavy-flow-grid" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-heavy-flow-battery" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Sci-Fi Grid Overlay */}
          <rect width="900" height="370" fill="url(#scifi-grid)" />

          {/* Tactical Crosshairs & Alignment Marks */}
          <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" fill="none">
            <line x1="450" y1="20" x2="450" y2="350" strokeDasharray="4 8" />
            <line x1="100" y1="185" x2="800" y2="185" strokeDasharray="4 8" />
            <circle cx="450" cy="185" r="120" strokeDasharray="2 6" />
          </g>

          {/* Central Power Router Hub */}
          <CentralPowerCore x={450} y={185} totalPower={totalFlowingPower} />

          {/* --- CONDUITS & ENERGY FLOWS --- */}

          {/* PV → Central Core → Haus */}
          <SciFiConduit
            d="M 450 110 L 450 163"
            color={COLOR.pv}
            active={pvAcActive}
            watts={pvAcActive ? pvAc : undefined}
            testid="flow-conduit-pv-core"
          />
          <SciFiConduit
            d="M 450 207 L 450 260"
            color={COLOR.pv}
            active={pvAcActive || houseActive}
            watts={pvAcActive ? pvAc : house}
            testid="flow-conduit-core-house"
          />

          {/* PV → Akku (Direct MPPT DC Charge Diagonal Stream) */}
          <SciFiConduit
            d="M 530 95 L 700 220"
            color={COLOR.pv}
            active={chargeActive}
            watts={chargeActive ? charge : undefined}
            testid="flow-conduit-mppt-charge"
          />

          {/* Netz ↔ Haus / Central Core Stream */}
          <SciFiConduit
            d="M 220 270 L 360 270"
            color={gridColor}
            active={importActive || exportActive}
            reverse={exportActive}
            watts={(importActive || exportActive) ? totalGridAbs : undefined}
            testid="flow-conduit-grid"
          />

          {/* Akku ↔ Central Core / Haus Stream (SUN Discharge) */}
          <SciFiConduit
            d="M 680 270 L 540 270"
            color={COLOR.battery}
            active={dischargeActive}
            watts={dischargeActive ? discharge : undefined}
            testid="flow-conduit-battery-discharge"
          />

          {/* --- SCI-FI NODES --- */}

          {/* Top Node: PV Generator Core */}
          <SciFiNode
            x={450}
            y={60}
            w={180}
            h={90}
            label="PV-GENERATOR"
            value={Math.round(pv)}
            unit="W"
            color={COLOR.pv}
            Icon={Sun}
            testid="flow-pv"
            sub={pvProducing ? `AC ${Math.round(pvAc)}W · DC ${Math.round(pvDc)}W` : "NACHT / STANDBY"}
            glow={pvProducing}
            badgeText={pvProducing ? "SOLAR" : "OFFLINE"}
          />

          {/* Bottom Node: Haus Consumption Hub */}
          <SciFiNode
            x={450}
            y={310}
            w={180}
            h={90}
            label="HAUSHALT"
            value={Math.round(house)}
            unit="W"
            color={COLOR.house}
            Icon={Home}
            testid="flow-house"
            sub={houseActive ? "VERBRAUCH AKTIV" : "STANDBY LOAD"}
            glow={houseActive}
            badgeText="LAST"
          />

          {/* Left Node: Netz Grid Portal */}
          <SciFiNode
            x={130}
            y={270}
            w={180}
            h={90}
            label="STROMNETZ"
            value={Math.round(totalGridAbs)}
            unit="W"
            color={gridColor}
            Icon={Cable}
            testid="flow-grid"
            sub={gridLabel}
            glow={importActive || exportActive}
            badgeText={importActive ? "BEZUG" : exportActive ? "INJECTION" : "IDLE"}
          />

          {/* Right Node: Cyber Battery Storage */}
          <SciFiNode
            x={770}
            y={270}
            w={180}
            h={90}
            label="AKKU SPEICHER"
            value={Math.round(totalBatteryAbs)}
            unit="W"
            color={COLOR.battery}
            Icon={BatteryCharging}
            testid="flow-battery"
            sub={batterySub}
            glow={chargeActive || dischargeActive}
            badgeText={`${Math.round(soc)}%`}
            percent={soc}
          />
        </svg>
      </div>
    </div>
  );
}
