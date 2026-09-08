/* Alarm-Historie (raised/resolved mit Zeitstempel) aus /api/alarms/history.
   Wird auf der Diagnose-Seite (voll) und der Verlauf-Seite (compact) genutzt. */
import { useEffect, useState } from "react";
import { getAlarmHistory } from "../lib/api";
import { History, TriangleAlert, AlertOctagon, CheckCircle2 } from "lucide-react";

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export default function AlarmHistory({ limit = 50, compact = false }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    const tick = () => getAlarmHistory(limit).then((d) => { if (alive) setEvents(d.events || []); }).catch(() => {});
    tick();
    const id = setInterval(tick, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [limit]);

  return (
    <div className="glass" data-testid="alarm-history" style={{ borderLeft: "3px solid #FB923C" }}>
      <div className="border-b border-white/10 px-4 py-2 flex items-center gap-2">
        <History size={14} className="text-orange-300" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">Alarm-Historie</span>
        <span className="ml-auto font-mono text-[10px] text-white/40">{events.length} Einträge</span>
      </div>

      {events.length === 0 ? (
        <div className="px-4 py-6 font-mono text-xs text-white/45" data-testid="alarm-history-empty">
          Keine Alarme protokolliert.
        </div>
      ) : (
        <ul className={`divide-y divide-white/[0.06] ${compact ? "max-h-64" : "max-h-[420px]"} overflow-y-auto`}>
          {events.map((e) => {
            const resolved = e.event === "resolved";
            const crit = e.severity === "critical";
            const dot = resolved ? "#10B981" : crit ? "#F87171" : "#FB923C";
            const EvIcon = resolved ? CheckCircle2 : crit ? AlertOctagon : TriangleAlert;
            return (
              <li key={e.id} data-testid={`alarm-event-${e.event}`} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${
                        resolved ? "text-emerald-300 bg-emerald-400/10" : crit ? "text-red-300 bg-red-500/10" : "text-orange-300 bg-orange-500/10"
                      }`}
                    >
                      <EvIcon size={10} /> {resolved ? "Behoben" : "Ausgelöst"}
                    </span>
                    {!compact && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">{e.device_label}</span>
                    )}
                    <span className={`text-[13px] leading-snug ${resolved ? "text-white/55" : crit ? "text-red-200/90" : "text-orange-200/90"} truncate`}>
                      {e.message}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-white/40 shrink-0 pt-0.5">{fmtTime(e.ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
