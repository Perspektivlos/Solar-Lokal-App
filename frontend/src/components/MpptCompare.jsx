import { GlassCard, Badge, formatNum } from "./solar-ui";
import { Sun } from "lucide-react";
import { MPPT_ARRAY, mpptPeakKwp } from "../lib/mppt";

const BAR_COLOR = ["#FACC15", "#34D399"];

// String-Ertragsvergleich MPPT #1 vs #2: Tages-Ertrag (kWh) im Fokus,
// zusätzlich spezifischer Ertrag (kWh/kWp) für fairen Vergleich unterschiedlich
// großer Strings, plus aktuelle Leistung und Differenz.
export default function MpptCompare({ mppts }) {
  const list = (mppts || []).slice(0, 2);
  const yields = list.map((m) => m.yield_today || 0);
  const maxYield = Math.max(0.001, ...yields);
  const spec = list.map((m, i) => { const kwp = mpptPeakKwp(i); return kwp > 0 ? (m.yield_today || 0) / kwp : 0; });

  const diffYield = yields.length === 2 ? Math.abs(yields[0] - yields[1]) : 0;
  const leader = yields.length === 2 ? (yields[0] === yields[1] ? null : (yields[0] > yields[1] ? 0 : 1)) : null;
  const specLeader = spec.length === 2 ? (Math.abs(spec[0] - spec[1]) < 0.01 ? null : (spec[0] > spec[1] ? 0 : 1)) : null;
  const specDiff = spec.length === 2 ? Math.abs(spec[0] - spec[1]) : 0;

  return (
    <GlassCard title="String-Ertragsvergleich · heute" accent="#34D399" icon={Sun} testid="card-mppt-compare" badge={<Badge kind="NORMAL" label="SOLAR DC" />}>
      <div className="space-y-4">
        {list.length < 2 && (
          <div className="font-mono text-[11px] text-white/50">Weniger als zwei MPPTs verfügbar.</div>
        )}
        {list.map((m, i) => {
          const col = BAR_COLOR[i];
          const cfg = MPPT_ARRAY[i] || { panels: 4, wp: 0 };
          const kwp = mpptPeakKwp(i);
          return (
            <div key={m.id ?? i} data-testid={`mppt-compare-${i + 1}`}>
              <div className="flex items-center justify-between font-mono text-[11px] mb-1.5">
                <span className="text-white/85 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: col }} />
                  {m.name || `MPPT #${i + 1}`}
                  {leader === i && <span className="text-emerald-300 text-[9px] uppercase tracking-wider border border-emerald-400/40 px-1 rounded">Top</span>}
                </span>
                <span className="text-white/55 text-[9px] uppercase tracking-wider border border-white/15 px-1.5 rounded">
                  {cfg.panels}× {cfg.wp} Wp · {formatNum(kwp, 2)} kWp
                </span>
              </div>
              {/* Primär: Tages-Ertrag (kWh) */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 glass-inset relative overflow-hidden rounded-sm">
                  <div className="absolute inset-y-0 left-0 transition-all" style={{ width: `${((m.yield_today || 0) / maxYield) * 100}%`, background: `linear-gradient(90deg, ${col}, ${col}66)`, boxShadow: `0 0 8px ${col}66` }} />
                </div>
                <span className="font-mono text-base font-medium text-white w-24 text-right" data-testid={`mppt-yield-${i + 1}`}>{formatNum(m.yield_today, 2)} kWh</span>
              </div>
              {/* Sekundär: spezifischer Ertrag + aktuelle Leistung */}
              <div className="font-mono text-[10px] text-white/55 mt-1.5 flex items-center justify-between">
                <span>
                  spezifisch <span className="text-white/85">{formatNum(spec[i], 2)} kWh/kWp</span>
                  {specLeader === i && list.length === 2 && <span className="text-cyan-300"> · effizienter</span>}
                </span>
                <span className="text-white/70">{formatNum(m.pv_power, 0)} W</span>
              </div>
            </div>
          );
        })}
        {list.length === 2 && (
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <div className="font-mono text-[10px] text-white/60 flex items-center justify-between">
              <span>Ertrags-Differenz heute</span>
              <span className="text-white" data-testid="mppt-compare-diff">
                {formatNum(diffYield, 2)} kWh{leader !== null && <span className="text-emerald-300"> · {list[leader]?.name || `#${leader + 1}`} führt</span>}
              </span>
            </div>
            {specLeader !== null && leader !== null && specLeader !== leader && specDiff > 0.05 && (
              <div className="font-mono text-[10px] text-cyan-300/90 flex items-center gap-1.5">
                <span className="inline-block w-1 h-1 rounded-full bg-cyan-300" />
                {list[specLeader]?.name || `#${specLeader + 1}`} liefert pro kWp mehr – kleinerer String, aber effizienter.
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
