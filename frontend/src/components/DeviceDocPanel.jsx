import { ChevronDown, ChevronRight, Loader2, ScanLine, CheckCircle2, AlertTriangle, FlaskConical, ArrowUpCircle, HelpCircle, GitCompare } from "lucide-react";

const STATUS_META = {
  demo: { label: "Demo", cls: "text-yellow-300", Icon: FlaskConical },
  ok: { label: "Erkannt", cls: "text-emerald-300", Icon: CheckCircle2 },
  error: { label: "Fehlgeschlagen", cls: "text-red-300", Icon: AlertTriangle },
};

const FW_META = {
  current: { label: "Aktuell", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", Icon: CheckCircle2 },
  outdated: { label: "Update verfügbar", cls: "text-amber-300 border-amber-400/40 bg-amber-400/10", Icon: ArrowUpCircle },
  unknown: { label: "Version unbekannt", cls: "text-white/50 border-white/20 bg-white/5", Icon: HelpCircle },
};

function fmtTime(iso) {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "–";
  }
}

const FwBadge = ({ status, latest, hint, testid }) => {
  const m = FW_META[status];
  if (!m) return null;
  const text = status === "outdated" ? (hint || `Update verfügbar → v${latest}`) : m.label;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[9px] uppercase tracking-[0.12em] ${m.cls}`} data-testid={testid}>
      <m.Icon size={11} /> {text}
    </span>
  );
};

export const DeviceDocPanel = ({ deviceKey, accent, info, discovering, onDiscover, expanded, onToggle }) => {
  const status = info?.status;
  const meta = STATUS_META[status];
  const fields = info?.fields || [];
  const hasData = fields.length > 0;
  const fwOutdated = info?.firmware?.status === "outdated";
  const changedCount = info?.changed_count || 0;
  const hasPrevScan = !!info?.prev_detected_at;

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
        <div className="flex items-center gap-3 flex-wrap">
          {changedCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-300 font-mono text-[9px] uppercase tracking-[0.12em]"
              data-testid={`doc-changed-chip-${deviceKey}`}
            >
              <GitCompare size={11} /> {changedCount} geändert
            </span>
          )}
          {fwOutdated && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-300 font-mono text-[9px] uppercase tracking-[0.12em]"
              data-testid={`doc-fw-chip-${deviceKey}`}
            >
              <ArrowUpCircle size={11} /> FW-Update
            </span>
          )}
          {meta && (
            <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${meta.cls}`} data-testid={`doc-status-${deviceKey}`}>
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
          {changedCount > 0
            ? ` · ${changedCount} Wert(e) geändert`
            : hasPrevScan
            ? " · unverändert seit letztem Scan"
            : ""}
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
                  <dd className="font-mono text-sm break-all flex items-center gap-2 flex-wrap">
                    <span className={f.changed ? "text-amber-300" : "text-white/90"}>{f.value}</span>
                    {f.fw_status && <FwBadge status={f.fw_status} latest={f.fw_latest} hint={f.fw_hint} testid={`doc-fw-${deviceKey}`} />}
                    {f.changed && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-300 font-mono text-[9px] uppercase tracking-[0.1em]"
                        data-testid={`doc-changed-${deviceKey}`}
                      >
                        <GitCompare size={10} /> geändert
                      </span>
                    )}
                  </dd>
                  {f.changed && f.prev != null && (
                    <span className="font-mono text-[9px] text-white/35 mt-0.5">vorher: {f.prev}</span>
                  )}
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
