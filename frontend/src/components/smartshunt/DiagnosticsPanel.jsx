import { Check, CircleAlert, Minus, RadioTower, ShieldCheck, X } from "lucide-react";
import { clock, testKey } from "./format";

const CheckIcon = ({ ok }) => ok === true ? <Check size={15} className="text-emerald-300" /> : ok === false ? <X size={15} className="text-red-300" /> : <Minus size={15} className="text-white/40" />;

export const DiagnosticsPanel = ({ payload }) => {
  const data = payload.current;
  const diagnostics = payload.diagnostics || {};
  const raw = data.raw || {};
  return (
    <div className="space-y-5" data-testid="smartshunt-diagnostics-panel">
      <section className="glass overflow-hidden" data-testid="smartshunt-diagnostic-checks">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]"><ShieldCheck size={15} className="text-cyan-300" /> Integritätsprüfung</div>
          <span className="font-mono text-[9px] text-white/45" data-testid="smartshunt-diagnostic-count">{diagnostics.checks?.length || 0} Prüfungen</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-5 py-2">
          {(diagnostics.checks || []).map((check) => (
            <div key={check.id} className="flex items-start gap-3 border-b border-white/[0.06] py-3" data-testid={`smartshunt-diagnostic-${check.id}`}>
              <span className="mt-0.5"><CheckIcon ok={check.ok} /></span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/85">{check.label}</div>
                <div className="mt-0.5 font-mono text-[10px] text-white/45 break-all" data-testid={`smartshunt-diagnostic-${check.id}-detail`}>{check.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[0.7fr_1.3fr] gap-5">
        <div className="glass p-5" data-testid="smartshunt-mqtt-diagnostic">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]"><RadioTower size={15} className="text-cyan-300" /> MQTT-Empfang</div>
          <div className="mt-5 space-y-4 font-mono text-xs">
            <div><div className="text-white/35 uppercase tracking-[0.15em] text-[9px]">Topic-Basis</div><div className="mt-1 break-all text-cyan-200" data-testid="smartshunt-diagnostic-topic">{payload.topic_base}</div></div>
            <div><div className="text-white/35 uppercase tracking-[0.15em] text-[9px]">Rohfelder</div><div className="mt-1 text-white/80" data-testid="smartshunt-raw-field-count">{diagnostics.raw_field_count ?? 0}</div></div>
            <div><div className="text-white/35 uppercase tracking-[0.15em] text-[9px]">Broker-Nachrichten gesamt</div><div className="mt-1 text-white/80" data-testid="smartshunt-mqtt-message-count">{diagnostics.message_count ?? 0}</div></div>
            <div><div className="text-white/35 uppercase tracking-[0.15em] text-[9px]">Datenalter</div><div className="mt-1 text-white/80" data-testid="smartshunt-diagnostic-age">{data.age_seconds == null ? "–" : `${Math.round(data.age_seconds)} s`}</div></div>
          </div>
        </div>

        <div className="glass overflow-hidden" data-testid="smartshunt-raw-fields">
          <div className="border-b border-white/[0.08] px-5 py-3 text-xs font-bold uppercase tracking-[0.15em]">Empfangene Venus-OS-Felder</div>
          <div className="max-h-[390px] overflow-y-auto px-5 py-2 divide-y divide-white/[0.06]">
            {Object.entries(raw).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-4 py-2 text-xs">
                <span className="font-mono text-white/45 break-all">{key}</span>
                <span className="font-mono text-right text-white/80 break-all" data-testid={`smartshunt-raw-${testKey(key)}`}>{value == null ? "–" : String(value)}</span>
              </div>
            ))}
            {!Object.keys(raw).length && <div className="py-8 text-center font-mono text-xs text-white/40" data-testid="smartshunt-raw-empty">Noch keine MQTT-Felder empfangen.</div>}
          </div>
        </div>
      </section>

      <section className="glass overflow-hidden" data-testid="smartshunt-event-history">
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-5 py-3 text-xs font-bold uppercase tracking-[0.15em]"><CircleAlert size={15} className="text-amber-300" /> Visuelle Alarmereignisse</div>
        <div className="px-5 py-2 divide-y divide-white/[0.06]">
          {(payload.events || []).map((event, index) => (
            <div key={`${event.ts}-${event.code}-${index}`} className="grid grid-cols-1 sm:grid-cols-[120px_100px_minmax(0,1fr)] gap-1 sm:gap-4 py-2.5 text-xs" data-testid={`smartshunt-event-${index}`}>
              <span className="font-mono text-white/40" data-testid={`smartshunt-event-${index}-time`}>{clock(event.ts)}</span>
              <span className={event.event === "raised" ? "text-amber-300" : "text-emerald-300"} data-testid={`smartshunt-event-${index}-state`}>{event.event === "raised" ? "Ausgelöst" : "Behoben"}</span>
              <span className="text-white/70" data-testid={`smartshunt-event-${index}-label`}>{event.label}</span>
            </div>
          ))}
          {!payload.events?.length && <div className="py-8 text-center font-mono text-xs text-white/40" data-testid="smartshunt-event-empty">Keine Alarmereignisse gespeichert.</div>}
        </div>
      </section>
    </div>
  );
};