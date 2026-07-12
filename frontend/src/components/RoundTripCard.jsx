import { RefreshCcw } from "lucide-react";

function formatNum(n, digits = 0) {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Ring-Gauge des Round-Trip-Wirkungsgrads (AC-Entladung ÷ DC-Ladung).
export default function RoundTripCard({ today }) {
  const pct = Math.max(0, Math.min(100, today?.round_trip_pct ?? 0));
  const charge = today?.battery_charge_kwh ?? 0;
  const discharge = today?.battery_discharge_kwh ?? 0;
  const hasData = charge > 0.05;

  const R = 34;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  const ringColor = pct >= 85 ? "#10B981" : pct >= 70 ? "#06B6D4" : "#FB923C";

  return (
    <div
      className="glass relative overflow-hidden"
      data-testid="card-roundtrip"
      style={{
        borderLeft: "3px solid #06B6D4",
        boxShadow: "0 12px 34px -18px rgba(0,0,0,0.6), 0 0 26px -16px rgba(226,232,240,0.22)",
      }}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ background: ringColor }} />
      <div className="relative border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">Akku · Round-Trip-Effizienz</div>
        <RefreshCcw size={12} className="text-cyan-300" />
      </div>
      <div className="relative p-4 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 84, height: 84 }}>
          <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
            <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
              cx="42" cy="42" r={R} fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              style={{ filter: `drop-shadow(0 0 5px ${ringColor}aa)`, transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-medium text-white" data-testid="roundtrip-pct">{hasData ? formatNum(pct, 0) : "–"}</span>
            <span className="font-mono text-[9px] text-white/45">%</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="glass-inset p-2" style={{ borderLeft: "3px solid #FACC15" }}>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">Geladen · DC (MPPT)</div>
            <div className="font-mono text-base text-yellow-300" data-testid="roundtrip-charge">{formatNum(charge, 2)}<span className="text-[10px] text-white/40"> kWh</span></div>
          </div>
          <div className="glass-inset p-2" style={{ borderLeft: "3px solid #06B6D4" }}>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">Entladen · AC (SUN)</div>
            <div className="font-mono text-base text-cyan-300" data-testid="roundtrip-discharge">{formatNum(discharge, 2)}<span className="text-[10px] text-white/40"> kWh</span></div>
          </div>
        </div>
      </div>
      {!hasData && (
        <div className="relative px-4 pb-3 font-mono text-[10px] text-white/45">
          Noch zu wenig Ladeenergie heute — Wirkungsgrad wird ab 0,05 kWh berechnet.
        </div>
      )}
    </div>
  );
}
