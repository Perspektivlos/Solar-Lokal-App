import { COLOR, formatNum, GlassCard, SourceBadge } from "./solar-ui";
import { Sun } from "lucide-react";
import { VICTRON_PEAK_W, mpptPeakW, utilizationPercent } from "../lib/mppt";

// Victron MPPT 150/35: pro Instanz P/U/VBatt/Yield + Gesamtleistung.
export default function VictronCard({ victron }) {
  const totalPercent = utilizationPercent(victron?.total_power, VICTRON_PEAK_W);
  return (
    <GlassCard title="Victron MPPT 150/35" accent={COLOR.victron} icon={Sun} badge={<SourceBadge data={victron} />} testid="card-victron">
      <div className="space-y-3">
        {victron.mppts?.map((m) => (
          <div key={m.id} className="border-b border-white/10 pb-2 last:border-b-0" data-testid={`victron-${m.id}`}>
            <div className="flex justify-between font-mono text-xs text-white/85">
              <span className="font-medium">{m.name}</span>
              <span className="text-white/60 uppercase tracking-wider text-[10px] border border-white/15 px-1.5 rounded">{m.state}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mt-1.5 font-mono text-xs text-white/80">
              <div><span className="text-[10px] text-white/55">Leistung</span><br/><span className="text-yellow-300 text-base font-medium" data-testid={`victron-${m.id}-power`}>{formatNum(m.pv_power, 0)}</span> W</div>
              <div><span className="text-[10px] text-white/55">Auslastung</span><br/><span className="text-white text-base font-medium" data-testid={`victron-${m.id}-percent`}>{utilizationPercent(m.pv_power, mpptPeakW((victron.mppts || []).indexOf(m))) == null ? "–" : formatNum(utilizationPercent(m.pv_power, mpptPeakW((victron.mppts || []).indexOf(m))), 0)}</span> %</div>
              <div><span className="text-[10px] text-white/55">Peak</span><br/><span data-testid={`victron-${m.id}-peak`}>{mpptPeakW((victron.mppts || []).indexOf(m)) || "–"} W</span></div>
              <div><span className="text-[10px] text-white/55">U</span><br/>{formatNum(m.pv_voltage, 1)} V</div>
              <div><span className="text-[10px] text-white/55">VBatt</span><br/>{formatNum(m.battery_voltage, 2)} V</div>
              <div><span className="text-[10px] text-white/55">Day</span><br/>{formatNum(m.yield_today, 2)} kWh</div>
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-white/10 font-mono">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Σ Total</span>
            <span className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-yellow-300 neon-text-yellow" data-testid="victron-total-power">{formatNum(victron.total_power, 0)}<span className="text-base ml-1 text-white/45 font-normal">W</span></span>
              <span className="text-2xl font-semibold tracking-tight text-white" data-testid="victron-total-percent">{totalPercent == null ? "–" : formatNum(totalPercent, 0)}<span className="text-base ml-1 text-white/45 font-normal">%</span></span>
            </span>
          </div>
          <div className="text-right font-mono text-[10px] text-white/40 mt-1" data-testid="victron-total-peak">Peak {formatNum(VICTRON_PEAK_W, 0)} W</div>
        </div>
      </div>
    </GlassCard>
  );
}
