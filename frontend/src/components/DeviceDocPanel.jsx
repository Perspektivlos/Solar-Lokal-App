import { ChevronDown, ChevronRight, Loader2, ScanLine, CheckCircle2, AlertTriangle, FlaskConical } from "lucide-react";

const STATUS_META = {
  demo: { label: "Demo", cls: "text-yellow-300", Icon: FlaskConical },
  ok: { label: "Erkannt", cls: "text-emerald-300", Icon: CheckCircle2 },
  error: { label: "Fehlgeschlagen", cls: "text-red-300", Icon: AlertTriangle },
};

function fmtTime(iso) {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "–";
  }
}

export const DeviceDocPanel = ({ deviceKey, accent, info, discovering, onDiscover, expanded, onToggle }) => {
  const status = info?.status;
  const meta = STATUS_META[status];
  const fields = info?.fields || [];
  const hasData = fields.length > 0;

  return (
    <div className="mt-4 border-t border-white/10 pt-3" data-testid={`doc-panel-${deviceKey}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onToggle}
          data-testid={`doc-toggle-${deviceKey}`}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Typenschild / Doku
        </button>
        <div className="flex items-center gap-3">
          {meta && (
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${meta.cls}`}
              data-testid={`doc-status-${deviceKey}`}
            >
              <meta.Icon size={12} /> {meta.label}
            </span>
          )}
          <button
            onClick={onDiscover}
            disabled={discovering}
            data-testid={`btn-discover-${deviceKey}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 glass font-mono text-[10px] uppercase tracking-[0.16em] text-white/80 hover:text-cyan-300 hover:border-cyan-400/40 transition-colors disabled:opacity-50"
          >
            {discovering ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} style={{ color: accent }} />}
            {discovering ? "Erkenne…" : "Erkennen"}
          </button>
        </div>
      </div>

      {info?.detected_at && (
        <div className="mt-1.5 font-mono text-[10px] text-white/40" data-testid={`doc-time-${deviceKey}`}>
          zuletzt erkannt: {fmtTime(info.detected_at)}
        </div>
      )}
      {status === "error" && info?.error && (
        <div className="mt-1.5 font-mono text-[10px] text-red-300/80" data-testid={`doc-error-${deviceKey}`}>
          {info.error}
        </div>
      )}

      {expanded && (
        <div className="mt-3" data-testid={`doc-fields-${deviceKey}`}>
          {hasData ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {fields.map((f) => (
                <div key={f.label} className="flex flex-col">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">{f.label}</dt>
                  <dd className="font-mono text-sm text-white/90 break-all">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="font-mono text-xs text-white/45">Noch keine Kenndaten erkannt. „Erkennen&ldquo; starten.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeviceDocPanel;
