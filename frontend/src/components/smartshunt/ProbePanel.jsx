import { useState } from "react";
import { Check, LoaderCircle, Play, ShieldCheck, X } from "lucide-react";
import { probeSmartShunt } from "../../lib/api";
import { clock } from "./format";

export const ProbePanel = () => {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const runProbe = async () => {
    setRunning(true); setError("");
    try { setResult(await probeSmartShunt()); }
    catch { setResult(null); setError("Lokaler SmartShunt-Prüflauf konnte nicht gestartet werden."); }
    finally { setRunning(false); }
  };
  return (
    <section className="glass overflow-hidden border-l-[3px] border-l-cyan-400/70" data-testid="smartshunt-probe-panel">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]"><ShieldCheck size={15} className="text-cyan-300" /> Lokale Hardwareprüfung</div>
          <div className="mt-1 text-xs text-white/45" data-testid="smartshunt-probe-readonly-note">Exakter battery/290-Empfang · nur N/ lesen und R/keepalive anfordern · keine W/-Befehle</div>
        </div>
        <button type="button" onClick={runProbe} disabled={running} data-testid="smartshunt-probe-button" className="btn-neo inline-flex h-9 shrink-0 items-center justify-center gap-2 px-3 font-mono text-[10px] uppercase tracking-[0.13em] disabled:opacity-50">
          {running ? <LoaderCircle size={13} className="animate-spin" /> : <Play size={13} />} {running ? "Prüfung läuft" : "Echte Daten prüfen"}
        </button>
      </div>
      {error && <div role="alert" className="px-5 py-4 text-sm text-red-200" data-testid="smartshunt-probe-error">{error}</div>}
      {!result && !error && <div className="px-5 py-4 font-mono text-[10px] text-white/40" data-testid="smartshunt-probe-idle">Der Prüflauf verwendet den MQTT-Zugang des lokal laufenden Backends.</div>}
      {result && (
        <div data-testid="smartshunt-probe-result">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-black/20">
            <div>
              <div className={`font-semibold ${result.passed ? "text-emerald-300" : "text-red-300"}`} data-testid="smartshunt-probe-verdict">{result.passed ? "Hardwareprüfung bestanden" : "Hardwareprüfung nicht bestanden"}</div>
              <div className="mt-1 font-mono text-[9px] text-white/40" data-testid="smartshunt-probe-meta">{clock(result.tested_at)} · {result.duration_ms} ms · {result.message_count} Nachrichten · {result.field_count} Felder</div>
            </div>
            <span data-testid="smartshunt-probe-status" className={`rounded-full border px-3 py-1 font-mono text-[9px] tracking-[0.15em] ${result.passed ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-red-400/40 bg-red-400/10 text-red-300"}`}>{result.passed ? "ABNAHMEBEREIT" : "PRÜFUNG FEHLGESCHLAGEN"}</span>
          </div>
          {!result.passed && <div className="border-b border-white/[0.06] px-5 py-3 text-xs text-red-200/80" data-testid="smartshunt-probe-reason">{result.current?.status_reason || "Prüfvoraussetzungen nicht erfüllt"}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-5 py-2">
            {(result.checks || []).map((check) => (
              <div key={check.id} className="flex items-start gap-3 border-b border-white/[0.06] py-3" data-testid={`smartshunt-probe-check-${check.id}`}>
                {check.ok ? <Check size={14} className="mt-0.5 shrink-0 text-emerald-300" /> : <X size={14} className="mt-0.5 shrink-0 text-red-300" />}
                <div className="min-w-0"><div className="text-sm text-white/80">{check.label}</div><div className="mt-0.5 font-mono text-[10px] text-white/40 break-all" data-testid={`smartshunt-probe-check-${check.id}-detail`}>{check.detail}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};