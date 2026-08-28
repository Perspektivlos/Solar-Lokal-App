import { GlassCard, Badge, Stat, formatNum } from "./solar-ui";
import { BatteryCharging } from "lucide-react";

// Ring-Gauge des Round-Trip-Wirkungsgrads (AC-Entladung ÷ DC-Ladung).
export default function RoundTripCard({ today }) {
  const pct = Math.max(0, Math.min(100, today?.round_trip_pct ?? 0));
  const charge = today?.battery_charge_kwh ?? 0;
  const discharge = today?.battery_discharge_kwh ?? 0;
  const hasData = charge > 0.05 && discharge > 0.02;

  const R = 34;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  const ringColor = pct >= 85 ? "#10B981" : pct >= 70 ? "#06B6D4" : "#FB923C";
  const badgeKind = !hasData ? "IDLE" : pct >= 85 ? "NORMAL" : pct >= 70 ? "LADEN" : "ENTLADEN";
  const badgeLabel = !hasData ? "WARTET" : pct >= 85 ? "OPTIMAL" : pct >= 70 ? "GUT" : "SCHWACH";

  return (
    <GlassCard title="Akku · Round-Trip-Effizienz" accent="#06B6D4" icon={BatteryCharging} testid="card-roundtrip" badge={<Badge kind={badgeKind} label={badgeLabel} />}>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx="44" cy="44" r={R} fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              style={{ filter: `drop-shadow(0 0 6px ${ringColor}aa)`, transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-semibold tracking-tight text-white" data-testid="roundtrip-pct">{hasData ? formatNum(pct, 0) : "–"}</span>
            <span className="font-mono text-[9px] text-white/45">%</span>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <Stat label="Geladen · DC (MPPT)" value={formatNum(charge, 2)} unit="kWh" color="text-yellow-300" testid="roundtrip-charge" />
          <Stat label="Entladen · AC (SUN)" value={formatNum(discharge, 2)} unit="kWh" color="text-cyan-300" testid="roundtrip-discharge" />
        </div>
      </div>
      {!hasData && (
        <div className="mt-3 font-mono text-[10px] text-white/45">
          Noch zu wenig Energie heute — Wirkungsgrad wird erst ab 0,05 kWh Ladung und 0,02 kWh Entladung berechnet.
        </div>
      )}
    </GlassCard>
  );
}
