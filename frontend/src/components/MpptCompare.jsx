import { GitCompareArrows } from "lucide-react";

function formatNum(n, digits = 0) {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const BAR_COLOR = ["#FACC15", "#34D399"];

// Vergleichskachel MPPT #1 vs #2 (aktuelle Leistung + Yield heute + Differenz).
export default function MpptCompare({ mppts }) {
  const list = (mppts || []).slice(0, 2);
  const maxPower = Math.max(1, ...list.map((m) => m.pv_power || 0));
  const maxYield = Math.max(0.001, ...list.map((m) => m.yield_today || 0));

  const yields = list.map((m) => m.yield_today || 0);
  const diffYield = yields.length === 2 ? Math.abs(yields[0] - yields[1]) : 0;
  const leader = yields.length === 2 ? (yields[0] === yields[1] ? null : (yields[0] > yields[1] ? 0 : 1)) : null;

  return (
    <div
      className="glass relative overflow-hidden"
      data-testid="card-mppt-compare"
      style={{ borderLeft: "3px solid #34D399", boxShadow: "0 12px 34px -18px rgba(0,0,0,0.6), 0 0 26px -16px rgba(226,232,240,0.22)" }}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ background: "#34D399" }} />
      <div className="relative border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">MPPT-Vergleich · Yield #1 vs #2</div>
        <GitCompareArrows size={12} className="text-emerald-300" />
      </div>
      <div className="relative p-4 space-y-4">
        {list.length < 2 && (
          <div className="font-mono text-[11px] text-white/50">Weniger als zwei MPPTs verfügbar.</div>
        )}
        {list.map((m, i) => {
          const col = BAR_COLOR[i];
          return (
            <div key={m.id ?? i} data-testid={`mppt-compare-${i + 1}`}>
              <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                <span className="text-white/80 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: col }} />
                  {m.name || `MPPT #${i + 1}`}
                  {leader === i && <span className="text-emerald-300 text-[9px] uppercase tracking-wider border border-emerald-400/40 px-1 rounded">Top</span>}
                </span>
                <span className="text-white/60 uppercase tracking-wider text-[9px] border border-white/15 px-1.5 rounded">{m.state || "–"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 glass-inset relative overflow-hidden rounded-sm">
                  <div className="absolute inset-y-0 left-0 transition-all" style={{ width: `${((m.pv_power || 0) / maxPower) * 100}%`, background: `linear-gradient(90deg, ${col}, ${col}66)`, boxShadow: `0 0 8px ${col}66` }} />
                </div>
                <span className="font-mono text-[11px] text-yellow-300 w-16 text-right">{formatNum(m.pv_power, 0)} W</span>
              </div>
              <div className="font-mono text-[10px] text-white/55 mt-1 flex items-center justify-between">
                <span>Yield heute</span>
                <span className="text-white/85">{formatNum(m.yield_today, 2)} kWh</span>
              </div>
              <div className="h-1 mt-1 glass-inset relative overflow-hidden rounded-full">
                <div className="absolute inset-y-0 left-0" style={{ width: `${((m.yield_today || 0) / maxYield) * 100}%`, background: col, opacity: 0.7 }} />
              </div>
            </div>
          );
        })}
        {list.length === 2 && (
          <div className="font-mono text-[10px] text-white/60 pt-1 border-t border-white/10 flex items-center justify-between">
            <span>Yield-Differenz heute</span>
            <span className="text-white" data-testid="mppt-compare-diff">
              {formatNum(diffYield, 2)} kWh{leader !== null && <span className="text-emerald-300"> · {list[leader]?.name || `#${leader + 1}`} führt</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
