import { Check, Cpu, Database, Radio, X } from "lucide-react";
import { COUNTERS, OPTIONAL, duration, fmt } from "./format";

const identityRows = [
  ["product_name", "Produktname"], ["device_instance", "VRM-Instanz"],
  ["connection", "Verbindung"], ["connected", "Connected"],
  ["product_id", "Produkt-ID"], ["serial", "Seriennummer"],
  ["firmware", "Firmware"], ["hardware", "Hardware"],
];

const ValueRows = ({ rows, values, prefix }) => (
  <div className="divide-y divide-white/[0.06]">
    {rows.map(([key, label, unit = "", digits = 1]) => {
      if (!(key in (values || {}))) return null;
      const raw = values[key];
      const value = key === "time_since_full_charge_s" ? duration(raw) : `${fmt(raw, digits)}${unit ? ` ${unit}` : ""}`;
      return (
        <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2.5 text-sm">
          <span className="text-white/50">{label}</span>
          <span className="font-mono text-right text-white/90 break-all" data-testid={`${prefix}-${key.replaceAll("_", "-")}`}>{value}</span>
        </div>
      );
    })}
  </div>
);

export const DevicePanel = ({ payload }) => {
  const data = payload.current;
  const identity = data.identity || {};
  const verified = identity.valid && identity.connected === 1 && data.status !== "unavailable";
  const optional = data.status === "unavailable" ? {} : (data.optional || {});
  return (
    <div className="space-y-5" data-testid="smartshunt-device-panel">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="glass overflow-hidden" data-testid="smartshunt-identity-panel">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]"><Cpu size={15} className="text-cyan-300" /> Geräteidentität</div>
            <span data-testid="smartshunt-identity-badge" className={`rounded-full border px-2 py-1 font-mono text-[9px] tracking-[0.14em] ${verified ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-red-400/40 bg-red-400/10 text-red-300"}`}>{verified ? "VERIFIZIERT" : "NICHT BESTÄTIGT"}</span>
          </div>
          <div className="px-5 py-2 divide-y divide-white/[0.06]">
            {identityRows.map(([key, label]) => (
              <div key={key} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-2.5 text-sm">
                <span className="text-white/45">{label}</span>
                <span className="font-mono text-right text-white/85 break-all" data-testid={`smartshunt-identity-${key.replaceAll("_", "-")}`}>{identity[key] ?? "–"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass overflow-hidden" data-testid="smartshunt-optional-panel">
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-5 py-3 text-xs font-bold uppercase tracking-[0.15em]"><Radio size={15} className="text-cyan-300" /> Verfügbare Zusatzsensoren</div>
          <div className="px-5 py-2">
            {Object.keys(optional).length ? <ValueRows rows={OPTIONAL} values={optional} prefix="smartshunt-optional" /> : <div className="py-8 text-center font-mono text-xs text-white/40" data-testid="smartshunt-optional-empty">Keine Zusatzsensorwerte gemeldet.</div>}
          </div>
          <div className="mx-5 mb-4 border-t border-white/[0.06] pt-3 text-xs text-white/40" data-testid="smartshunt-optional-policy">Nur vom Gerät tatsächlich gelieferte Felder werden angezeigt.</div>
        </section>
      </div>

      <section className="glass overflow-hidden" data-testid="smartshunt-device-history-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]"><Database size={15} className="text-cyan-300" /> Gerätezähler &amp; Historie</div>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300" data-testid="smartshunt-history-source">direkt vom SmartShunt · nicht berechnet</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 px-5 py-2">
          <ValueRows rows={COUNTERS} values={data.device_history || {}} prefix="smartshunt-counter" />
        </div>
        {!Object.keys(data.device_history || {}).length && <div className="px-5 py-8 text-center font-mono text-xs text-white/40" data-testid="smartshunt-device-history-empty">Noch keine Gerätezähler empfangen.</div>}
      </section>

      <section className="glass p-5" data-testid="smartshunt-identity-checks">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Identitätsprüfung</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {Object.entries(identity.checks || {}).map(([key, ok]) => (
            <div key={key} className="flex items-center gap-2 border border-white/[0.08] bg-black/20 px-3 py-2 rounded" data-testid={`smartshunt-identity-check-${key}`}>
              {ok ? <Check size={14} className="text-emerald-300" /> : <X size={14} className="text-red-300" />}
              <span className="font-mono text-[10px] uppercase text-white/65">{key}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};