/* Selbst-Test-Verlauf: letzte manuelle Läufe + je Prüfung „zuletzt OK / zuletzt ausgefallen". */
import { History } from "lucide-react";

const fmt = (ts) => (ts ? new Date(ts).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");

const STATUS = {
  true: { label: "OK", cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10" },
  false: { label: "FEHLER", cls: "text-red-300 border-red-400/40 bg-red-400/10" },
  null: { label: "ÜBERSPR.", cls: "text-white/50 border-white/15 bg-white/5" },
};

function RunStrip({ runs }) {
  const ordered = [...runs].reverse();
  return (
    <div className="flex items-end gap-[3px] h-7" data-testid="selftest-run-strip">
      {ordered.map((r) => {
        const fail = r.summary?.fail > 0;
        return (
          <span key={r.timestamp} title={`${fmt(r.timestamp)} · ${r.summary?.pass} OK · ${r.summary?.fail} Fehler`}
            className={`w-2 rounded-sm ${fail ? "bg-red-400/80 h-7" : "bg-emerald-400/70 h-5"}`} />
        );
      })}
    </div>
  );
}

export default function SelftestHistory({ history }) {
  const runs = history?.runs || [];
  const checks = history?.checks || [];
  return (
    <div className="glass" data-testid="selftest-history">
      <div className="border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65 flex items-center gap-2">
          <History size={12} className="text-violet-300" /> Selbst-Test-Verlauf
        </div>
        <div className="font-mono text-[10px] text-white/45" data-testid="selftest-history-count">
          {runs.length} von max. {history?.keep ?? 50} Läufen · nur manuelle Tests
        </div>
      </div>
      {!runs.length ? (
        <div className="p-4 font-mono text-sm text-white/55" data-testid="selftest-history-empty">Noch kein Verlauf – starte einen Selbst-Test.</div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <RunStrip runs={runs} />
            <div className="font-mono text-[10px] text-white/45">letzter Lauf: <span className="text-white/75">{fmt(runs[0].timestamp)}</span></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs min-w-[560px]" data-testid="selftest-history-table">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/40 border-b border-white/10">
                  <th className="py-2 pr-3 font-normal">Prüfung</th>
                  <th className="py-2 pr-3 font-normal">Zuletzt</th>
                  <th className="py-2 pr-3 font-normal">Zuletzt OK</th>
                  <th className="py-2 pr-3 font-normal">Zuletzt ausgefallen</th>
                  <th className="py-2 font-normal text-right">Ausfälle</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => {
                  const st = STATUS[String(c.last_status)] || STATUS.null;
                  return (
                    <tr key={c.name} className="border-b border-white/5 last:border-b-0" data-testid={`selftest-check-${c.name.replace(/\s+/g, "-").toLowerCase()}`}>
                      <td className="py-2 pr-3 text-white/85">{c.name}</td>
                      <td className="py-2 pr-3"><span className={`px-1.5 py-0.5 rounded border text-[9px] tracking-[0.1em] ${st.cls}`}>{st.label}</span></td>
                      <td className="py-2 pr-3 text-white/60">{fmt(c.last_ok)}</td>
                      <td className={`py-2 pr-3 ${c.last_fail ? "text-red-300" : "text-white/35"}`} title={c.last_fail_detail || ""}>
                        {c.last_fail ? fmt(c.last_fail) : "nie"}
                      </td>
                      <td className={`py-2 text-right ${c.fails ? "text-red-300" : "text-white/40"}`}>{c.fails}/{c.runs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
