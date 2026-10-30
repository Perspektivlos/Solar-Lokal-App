/* Titelleiste der Energie-Analyse: Titel, Live-Badge, Ansichts- und Zeitumschalter. */
import { Activity, Layers, BarChart3, ExternalLink } from "lucide-react";
import { RANGES } from "./shared";

const VIEWS = [
  { id: "multi", label: "Multilinie (Option 1)", icon: Layers },
  { id: "four", label: "4 Kanäle (Option 2)", icon: BarChart3 },
];

const GROUP = "inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0b0f17] p-1";

export default function TitleBar({ view, onView, range, onRange, grafanaUrl }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6" data-testid="vp-titlebar">
      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap min-w-0 lg:flex-1">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center w-9 h-9 rounded-lg border border-cyan-400/30 bg-cyan-400/10 shrink-0">
            <Activity size={17} className="text-cyan-300" />
          </span>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight" data-testid="vp-title">Energie-Analyse &amp; Recharts Zeitverlauf</h1>
        </div>
        <span className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] text-emerald-300" data-testid="vp-live-badge">
          Live Synchron
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {grafanaUrl && (
          <a href={grafanaUrl} target="_blank" rel="noopener noreferrer" title={`Grafana öffnen · ${grafanaUrl}`} data-testid="grafana-link"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.07] font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-200 hover:bg-cyan-400/15 transition-colors">
            <BarChart3 size={13} /> Grafana <ExternalLink size={11} className="opacity-60" />
          </a>
        )}
        <div className={GROUP} role="group" aria-label="Ansicht" data-testid="vp-view-toggle">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" onClick={() => onView(v.id)} aria-pressed={view === v.id} data-testid={`vp-view-${v.id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${view === v.id ? "bg-cyan-500/15 text-cyan-200 border border-cyan-400/30" : "text-white/50 border border-transparent hover:text-white/85"}`}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        <div className={GROUP} role="group" aria-label="Zeitspanne" data-testid="vp-range-toggle">
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => onRange(r)} aria-pressed={range === r} data-testid={`vp-range-${r}`}
              className={`px-2.5 py-1.5 rounded-lg font-mono text-[12px] transition-colors ${range === r ? "bg-white/10 text-white font-semibold" : "text-white/50 hover:text-white/85"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
