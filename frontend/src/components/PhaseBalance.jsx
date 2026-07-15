import { Scale } from "lucide-react";

function formatNum(n, digits = 0) {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const PHASE_COLOR = { L1: "#FACC15", L2: "#06B6D4", L3: "#A78BFA" };

// Prominente 3-Phasen-Schieflast-Anzeige (Balken je Phase + Unbalance-Indikator).
export default function PhaseBalance({ phases }) {
  const list = phases || [];
  const mags = list.map((p) => Math.abs(p.power || 0));
  const maxAbs = Math.max(1, ...mags);
  const avg = mags.length ? mags.reduce((a, b) => a + b, 0) / mags.length : 0;
  const spread = mags.length ? Math.max(...mags) - Math.min(...mags) : 0;
  const unbalancePct = avg > 0 ? Math.min(100, (spread / avg) * 100) : 0;

  const status = unbalancePct < 15
    ? { label: "Symmetrisch", color: "#10B981" }
    : unbalancePct < 30
      ? { label: "Leichte Schieflast", color: "#FB923C" }
      : { label: "Starke Schieflast", color: "#F87171" };

  return (
    <div
      className="glass relative overflow-hidden"
      data-testid="card-phase-balance"
      style={{ borderLeft: `3px solid ${status.color}`, boxShadow: "0 12px 34px -18px rgba(0,0,0,0.6), 0 0 26px -16px rgba(226,232,240,0.22)" }}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ background: status.color }} />
      <div className="relative border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">3-Phasen-Schieflast</div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: status.color }} data-testid="phase-balance-status">
          <Scale size={12} />
          {status.label}
        </span>
      </div>
      <div className="relative p-4 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">Spread (max − min)</div>
            <div className="font-mono text-2xl font-medium" style={{ color: status.color }} data-testid="phase-balance-spread">
              {formatNum(spread, 0)}<span className="text-xs ml-1 text-white/45">W</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">Unbalance</div>
            <div className="font-mono text-xl text-white" data-testid="phase-balance-pct">{formatNum(unbalancePct, 0)}%</div>
          </div>
        </div>
        <div className="space-y-2">
          {list.map((p) => {
            const mag = Math.abs(p.power || 0);
            const isImport = (p.power || 0) >= 0;
            const col = PHASE_COLOR[p.phase] || "#cbd5e1";
            return (
              <div key={p.phase} className="flex items-center gap-2" data-testid={`phase-bar-${p.phase}`}>
                <span className="font-mono text-[11px] text-white/70 w-6">{p.phase}</span>
                <div className="flex-1 h-4 glass-inset relative overflow-hidden rounded-sm">
                  <div
                    className="absolute inset-y-0 left-0 transition-all"
                    style={{ width: `${(mag / maxAbs) * 100}%`, background: `linear-gradient(90deg, ${col}, ${col}66)`, boxShadow: `0 0 8px ${col}66` }}
                  />
                </div>
                <span className={`font-mono text-[11px] w-20 text-right ${isImport ? "text-red-300" : "text-emerald-300"}`}>
                  {isImport ? "+" : ""}{formatNum(p.power, 0)} W
                </span>
              </div>
            );
          })}
        </div>
        <div className="font-mono text-[10px] text-white/45 pt-1 border-t border-white/10">
          Ø je Phase {formatNum(avg, 0)} W · hohe Schieflast belastet einzelne Phasen stärker.
        </div>
      </div>
    </div>
  );
}
