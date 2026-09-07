/* Globales System-Statuslicht im Header (auf allen Seiten sichtbar).
   Pollt /api/alarms und zeigt eine SCADA-typische Statusampel. */
import { useEffect, useState } from "react";
import { getAlarms } from "../lib/api";
import { ShieldCheck, TriangleAlert, AlertOctagon } from "lucide-react";

const CFG = {
  ok: { dot: "#10B981", text: "text-emerald-300", Icon: ShieldCheck, label: "OK" },
  warning: { dot: "#FB923C", text: "text-orange-300", Icon: TriangleAlert, label: "WARNUNG" },
  critical: { dot: "#F87171", text: "text-red-300", Icon: AlertOctagon, label: "ALARM" },
};

export default function SystemStatusLight() {
  const [state, setState] = useState({ level: "ok", count: 0, critical: 0, warning: 0 });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await getAlarms();
        if (alive) setState({ level: s.level || "ok", count: s.count || 0, critical: s.critical || 0, warning: s.warning || 0 });
      } catch {
        /* Header bleibt beim letzten bekannten Status */
      }
    };
    tick();
    const id = setInterval(tick, 7000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const c = CFG[state.level] || CFG.ok;
  const Icon = c.Icon;
  const title =
    state.level === "ok"
      ? "System OK · keine aktiven Alarme"
      : `${state.critical} kritisch · ${state.warning} Warnungen`;

  return (
    <div
      data-testid="system-status-light"
      data-level={state.level}
      title={title}
      className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
    >
      <span
        className={`w-2 h-2 rounded-full ${state.level !== "ok" ? "dot-pulse" : ""}`}
        style={{ background: c.dot, boxShadow: `0 0 8px ${c.dot}`, color: c.dot }}
      />
      <Icon size={13} className={c.text} />
      <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${c.text}`}>
        {c.label}
        {state.count > 0 && <span className="ml-1 text-white/60">{state.count}</span>}
      </span>
    </div>
  );
}
