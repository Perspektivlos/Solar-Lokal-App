import { COLOR, formatNum, GlassCard, SourceBadge, Stat } from "./solar-ui";
import { BatteryCharging } from "lucide-react";

// Trucki2Shelly-Speicherkarte: SoC, VBAT, Setpoints, AC-Output/ZEPC.
export default function TruckiCard({ trucki }) {
  return (
    <GlassCard title="Trucki2Shelly · Speicher" accent={COLOR.battery} icon={BatteryCharging} badge={<SourceBadge data={trucki} />} testid="card-trucki" danger={trucki?.soc !== undefined && trucki.soc < 15}>
      <div className="space-y-3">
        <div>
          <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">SoC (aus VBAT)</div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex-1 h-3 glass-inset relative overflow-hidden">
              <div className="absolute inset-y-0 left-0" style={{
                width: `${trucki.soc}%`,
                background: "linear-gradient(90deg, #0891b2, #06B6D4)",
                boxShadow: `0 0 10px ${COLOR.battery}88`,
              }} />
            </div>
            <div className="font-mono text-xl font-medium w-16 text-right text-white">{formatNum(trucki.soc, 0)}%</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="VBAT" value={formatNum(trucki.battery_voltage, 2)} unit="V" />
          <Stat label={trucki.battery_power >= 0 ? "lädt" : "entlädt"} value={formatNum(Math.abs(trucki.battery_power), 0)} unit={`W ${trucki.battery_power >= 0 ? "↓" : "↑"}`} color="text-cyan-300 neon-text-cyan" />
        </div>
        {trucki.target_w !== undefined && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 font-mono text-[11px]">
            <div className="text-center text-white/85"><span className="text-white/50">TARGET</span><br/><span className="text-sm">{formatNum(trucki.target_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">MIN</span><br/><span className="text-sm">{formatNum(trucki.min_power_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">MAX</span><br/><span className="text-sm">{formatNum(trucki.max_power_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">TAG</span><br/><span className="text-sm">{formatNum(trucki.day_energy_kwh, 2)} kWh</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">GESAMT</span><br/><span className="text-sm">{formatNum(trucki.total_energy_kwh, 1)}</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">TEMP</span><br/><span className="text-sm">{formatNum(trucki.temperature, 0)} °C</span></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div className="font-mono text-xs text-white/70">AC-Output: <span className={trucki.ac_output ? "text-emerald-300" : "text-white/30"}>{trucki.ac_output ? "● EIN" : "○ AUS"}</span></div>
          <div className="font-mono text-xs text-white/70">ZEPC: <span className={trucki.zepc ? "text-emerald-300" : "text-white/30"}>{trucki.zepc ? "● EIN" : "○ AUS"}</span></div>
        </div>
      </div>
    </GlassCard>
  );
}
