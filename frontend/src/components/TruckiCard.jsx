import { COLOR, formatNum, GlassCard, SourceBadge } from "./solar-ui";
import { BatteryCharging } from "lucide-react";

/**
 * Rendert den Status des Trucki2Shelly-Batteriespeichers als Statuskarte.
 * @param {Object} trucki - Mess- und Zustandsdaten des Batteriespeichers.
 * @returns {JSX.Element} Die gerenderte Batteriespeicherkarte.
 */
export default function TruckiCard({ trucki }) {
  const safeTrucki = trucki ?? {};

  return (
    <GlassCard title="Trucki2Shelly · Speicher" accent={COLOR.battery} icon={BatteryCharging} badge={<SourceBadge data={safeTrucki} />} testid="card-trucki" danger={safeTrucki.soc !== undefined && safeTrucki.soc < 15}>
      <div className="space-y-3">
        <div className="text-center">
          <div className="font-sans text-[11px] font-semibold tracking-[0.16em] text-white/70">SoC</div>
          <div className="font-mono text-3xl font-semibold tracking-tight leading-none mt-1.5 text-white">{formatNum(safeTrucki.soc, 0)}<span className="ml-1 font-normal">%</span></div>
          <div className="font-mono text-xs text-white/50 mt-1.5" data-testid="trucki-vbat">VBAT <span className="text-white">{formatNum(safeTrucki.battery_voltage, 2)} V</span></div>
        </div>
        {safeTrucki.target_w !== undefined && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 font-mono text-[11px]">
            <div className="text-center text-white/85"><span className="text-white/50">TARGET</span><br/><span className="text-sm">{formatNum(safeTrucki.target_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">MIN</span><br/><span className="text-sm">{formatNum(safeTrucki.min_power_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">MAX</span><br/><span className="text-sm">{formatNum(safeTrucki.max_power_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">TAG</span><br/><span className="text-sm">{formatNum(safeTrucki.day_energy_kwh, 2)} kWh</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">GESAMT</span><br/><span className="text-sm">{formatNum(safeTrucki.total_energy_kwh, 1)}</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">TEMP</span><br/><span className="text-sm">{formatNum(safeTrucki.temperature, 0)} °C</span></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div className="font-mono text-xs text-white/70">AC-Output: <span className={safeTrucki.ac_output ? "text-emerald-300" : "text-white/30"}>{safeTrucki.ac_output ? "● EIN" : "○ AUS"}</span></div>
          <div className="font-mono text-xs text-white/70">ZEPC: <span className={safeTrucki.zepc ? "text-emerald-300" : "text-white/30"}>{safeTrucki.zepc ? "● EIN" : "○ AUS"}</span></div>
        </div>
      </div>
    </GlassCard>
  );
}
