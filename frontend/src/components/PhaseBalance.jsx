import { GlassCard, Badge, formatNum } from "./solar-ui";
import { Cable } from "lucide-react";

const PHASE_COLOR = { L1: "#FACC15", L2: "#06B6D4", L3: "#A78BFA" };

// Prominente 3-Phasen-Schieflast-Anzeige (Balken je Phase + Unbalance-Indikator).
export default function PhaseBalance({ phases }) {
  const list = phases || [];
  const mags = list.map((p) => Math.abs(p.power || 0));
  const maxAbs = Math.max(1, ...mags);
  const avg = mags.length ? mags.reduce((a, b) => a + b, 0) / mags.length : 0;
  const spread = mags.length ? Math.max(...mags) - Math.min(...mags) : 0;
  // Standard-Definition Phasen-Unbalance: max. Abweichung vom Mittel ÷ Mittel.
  const maxDev = mags.length ? Math.max(...mags.map((m) => Math.abs(m - avg))) : 0;
  const unbalancePct = avg > 0 ? Math.min(100, (maxDev / avg) * 100) : 0;

  const status = unbalancePct < 15
    ? { color: "#10B981", kind: "NORMAL", label: "SYMMETRISCH" }
    : unbalancePct < 30
      ? { color: "#FB923C", kind: "WARN", label: "LEICHTE SCHIEFLAST" }
      : { color: "#F87171", kind: "KRITISCH", label: "STARKE SCHIEFLAST" };

  return (
    <GlassCard title="3-Phasen-Schieflast" accent={status.color} icon={Cable} testid="card-phase-balance" badge={<Badge kind={status.kind} label={status.label} testid="phase-balance-status" />}>
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Spread (max − min)</div>
            <div className="font-mono text-3xl lg:text-4xl font-semibold tracking-tight" style={{ color: status.color }} data-testid="phase-balance-spread">
              {formatNum(spread, 0)}<span className="text-lg ml-1.5 text-white/45 font-normal">W</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Unbalance</div>
            <div className="font-mono text-2xl font-medium text-white" data-testid="phase-balance-pct">{formatNum(unbalancePct, 0)}%</div>
          </div>
        </div>
        <div className="space-y-2">
          {list.map((p) => {
            const mag = Math.abs(p.power || 0);
            const isImport = (p.power || 0) >= 0;
            const col = PHASE_COLOR[p.phase] || "#cbd5e1";
            return (
              <div key={p.phase} className="flex items-center gap-2" data-testid={`phase-bar-${p.phase}`}>
                <span className="font-mono text-[12px] font-medium text-white/80 w-6">{p.phase}</span>
                <div className="flex-1 h-4 glass-inset relative overflow-hidden rounded-sm">
                  <div
                    className="absolute inset-y-0 left-0 transition-all"
                    style={{ width: `${(mag / maxAbs) * 100}%`, background: `linear-gradient(90deg, ${col}, ${col}66)`, boxShadow: `0 0 8px ${col}66` }}
                  />
                </div>
                <span className={`font-mono text-[12px] w-20 text-right ${isImport ? "text-red-300" : "text-emerald-300"}`}>
                  <span className="opacity-70">{isImport ? "+" : "−"}</span>{formatNum(mag, 0)} W
                </span>
              </div>
            );
          })}
        </div>
        <div className="font-mono text-[10px] text-white/50 pt-1 border-t border-white/10">
          Ø je Phase {formatNum(avg, 0)} W · hohe Schieflast belastet einzelne Phasen stärker.
        </div>
      </div>
    </GlassCard>
  );
}
