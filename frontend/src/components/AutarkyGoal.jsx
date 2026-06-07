/* Autarkie heute - Ring-Fortschritt gegen konfigurierbares Ziel (dark glass) */
import { useEffect, useState } from "react";
import { Target, Minus, Plus, CheckCircle2, Leaf } from "lucide-react";
import { getConfig, putConfig } from "../lib/api";
import { toast } from "sonner";

const SIZE = 176;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function fmt(n, d = 0) {
  if (n === undefined || n === null || Number.isNaN(n)) return "–";
  return Number(n).toFixed(d);
}

export default function AutarkyGoal({ autarky = 0, selfConsumption = 0, selfConsumedKwh = 0, consumptionKwh = 0 }) {
  const [goal, setGoal] = useState(70);

  useEffect(() => {
    let alive = true;
    getConfig()
      .then((c) => {
        if (alive && c?.goals?.autarky_pct != null) setGoal(c.goals.autarky_pct);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pct = Math.max(0, Math.min(100, autarky || 0));
  const reached = pct >= goal;
  const remaining = Math.max(0, goal - pct);
  const ringColor = reached ? "#34D399" : pct >= goal * 0.7 ? "#FACC15" : "#06B6D4";
  const dash = (pct / 100) * CIRC;

  // Ziel-Markierung auf dem Ring (Start oben, im Uhrzeigersinn)
  const goalAngle = (goal / 100) * 360 - 90;
  const gx = SIZE / 2 + R * Math.cos((goalAngle * Math.PI) / 180);
  const gy = SIZE / 2 + R * Math.sin((goalAngle * Math.PI) / 180);

  const saveGoal = async (next) => {
    const v = Math.max(0, Math.min(100, next));
    setGoal(v);
    try {
      await putConfig({ goals: { autarky_pct: v } });
    } catch (e) {
      toast.error("Ziel konnte nicht gespeichert werden");
    }
  };

  return (
    <div className="glass-strong" data-testid="autarky-goal-card">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65 flex items-center gap-2">
          <Leaf size={12} className="text-emerald-400" />
          Autarkie heute · Ziel-Fortschritt
        </div>
        <div
          className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded ${
            reached ? "text-emerald-300 bg-emerald-400/10" : "text-cyan-300 bg-cyan-400/10"
          }`}
          data-testid="autarky-goal-status"
        >
          {reached ? <CheckCircle2 size={11} /> : <Target size={11} />}
          {reached ? "Ziel erreicht" : `${fmt(remaining, 0)}% bis Ziel`}
        </div>
      </div>

      <div className="p-5 flex flex-col sm:flex-row items-center gap-6">
        {/* Ring */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} data-testid="autarky-ring">
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRC - dash}`}
              style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease", filter: `drop-shadow(0 0 6px ${ringColor}aa)` }}
            />
            {/* Ziel-Markierung */}
            <circle cx={gx} cy={gy} r={4.5} fill="#fff" stroke="#0f172a" strokeWidth={1.5} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-4xl font-medium text-white tabular-nums" data-testid="autarky-value">
              {fmt(pct, 0)}
              <span className="text-lg text-white/45">%</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 mt-0.5">Eigendeckung</span>
          </div>
        </div>

        {/* Breakdown + Ziel-Editor */}
        <div className="flex-1 w-full space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-inset p-3" style={{ borderLeft: "3px solid #06B6D4" }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">Eigenverbrauch</div>
              <div className="font-mono text-xl text-cyan-300 neon-text-cyan">{fmt(selfConsumption, 0)}<span className="text-sm text-white/40">%</span></div>
            </div>
            <div className="glass-inset p-3" style={{ borderLeft: "3px solid #34D399" }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">Selbst genutzt</div>
              <div className="font-mono text-xl text-emerald-300 neon-text-green">{fmt(selfConsumedKwh, 2)}<span className="text-sm text-white/40"> kWh</span></div>
            </div>
          </div>

          {/* Ziel-Editor */}
          <div className="glass-inset p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-[11px] text-white/65">
              <Target size={13} className="text-white/45" />
              Autarkie-Ziel
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => saveGoal(goal - 5)}
                className="w-7 h-7 grid place-items-center rounded border border-white/15 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/[0.06] transition-colors"
                data-testid="autarky-goal-decrease"
                aria-label="Ziel verringern"
              >
                <Minus size={13} />
              </button>
              <span className="font-mono text-lg text-white w-14 text-center tabular-nums" data-testid="autarky-goal-value">{fmt(goal, 0)}%</span>
              <button
                onClick={() => saveGoal(goal + 5)}
                className="w-7 h-7 grid place-items-center rounded border border-white/15 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/[0.06] transition-colors"
                data-testid="autarky-goal-increase"
                aria-label="Ziel erhöhen"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Fortschrittsbalken Verbrauchsanteil */}
          <div>
            <div className="flex items-center justify-between font-mono text-[10px] text-white/45 mb-1.5">
              <span>0%</span>
              <span>Tagesverbrauch: {fmt(consumptionKwh, 2)} kWh</span>
              <span>100%</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, background: ringColor, boxShadow: `0 0 10px ${ringColor}aa`, transition: "width 0.8s ease, background 0.4s ease" }}
              />
              <div className="absolute inset-y-0 w-[2px] bg-white/70" style={{ left: `${goal}%` }} title={`Ziel ${goal}%`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
