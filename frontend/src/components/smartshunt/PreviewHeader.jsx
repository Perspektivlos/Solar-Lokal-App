import { ArrowLeft, BatteryCharging, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { clock, statusMeta } from "./format";

export const PreviewHeader = ({ payload, refreshing, onRefresh }) => {
  const current = payload?.current || {};
  const status = statusMeta(current.status);
  return (
    <header className="border-b border-white/10 bg-[#070c18]/95" data-testid="smartshunt-preview-header">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" data-testid="smartshunt-preview-back" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300 hover:text-cyan-100 transition-colors">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid="smartshunt-preview-badge" className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-200">Vorschau · Phase 1</span>
            <span data-testid="smartshunt-mode-badge" className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-amber-200">{payload?.mode === "demo" ? "Demo-Daten" : "Lokale Live-Daten"}</span>
          </div>
        </div>
        <div className="mt-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-cyan-300">
              <span className="grid place-items-center w-10 h-10 rounded-md border border-cyan-400/35 bg-cyan-400/10"><BatteryCharging size={21} /></span>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">Venus OS · battery/290</div>
                <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-normal" data-testid="smartshunt-preview-title">SmartShunt IP65 300A</h1>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] text-white/50">
              <span className="inline-flex items-center gap-1.5" data-testid="smartshunt-readonly-status"><ShieldCheck size={12} className="text-emerald-300" /> lokal · nur lesend</span>
              <span data-testid="smartshunt-topic-base" className="break-all">{payload?.topic_base || "–"}</span>
              <span data-testid="smartshunt-last-update">Stand {clock(current.last_update)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span data-testid="smartshunt-status-badge" className={`rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] ${status.className}`}>{status.label}</span>
            <button type="button" onClick={onRefresh} disabled={refreshing} data-testid="smartshunt-refresh-button" className="btn-neo inline-flex h-9 items-center gap-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] disabled:opacity-50">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Aktualisieren
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};