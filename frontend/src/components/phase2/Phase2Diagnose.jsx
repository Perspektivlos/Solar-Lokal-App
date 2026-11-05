import { DiagnosticsPanel } from "../smartshunt/DiagnosticsPanel";

export const Phase2Diagnose = ({ live, phase1 }) => <div className="space-y-5" data-testid="phase2-diagnostics-view">
  <section className="glass p-4 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="phase2-source-audit">
    <div className="border-l-2 border-cyan-400 pl-3"><div className="font-mono text-[9px] uppercase text-cyan-300">DC-Quelle geprüft</div><div className="mt-1 text-sm text-white/65" data-testid="phase2-audit-dc">SmartShunt Instanz {live.battery_dc.instance} · {live.battery_dc.status}</div></div>
    <div className="border-l-2 border-violet-400 pl-3"><div className="font-mono text-[9px] uppercase text-violet-300">AC-Quelle getrennt</div><div className="mt-1 text-sm text-white/65" data-testid="phase2-audit-ac">Trucki/SUN · {live.inverter_ac.online ? "online" : "offline"} · ZEPC {live.inverter_ac.zepc ? "ein" : "aus"}</div></div>
  </section>
  <section className="glass p-4" data-testid="phase2-alarm-audit"><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Phase-2-Batteriealarme</div>{live.alarms?.length?<div className="mt-2 space-y-2">{live.alarms.map(a=><div key={a.code} className="flex justify-between gap-4 border-b border-white/[0.06] pb-2 text-sm"><span className="text-white/70">{a.label}</span><span className="font-mono text-[9px] uppercase text-amber-300" data-testid={`phase2-diagnostic-alarm-${a.code}`}>{a.source}</span></div>)}</div>:<div className="mt-2 text-sm text-emerald-300" data-testid="phase2-diagnostic-alarms-clear">Keine aktiven SmartShunt-Alarme</div>}</section>
  <DiagnosticsPanel payload={phase1} />
</div>;