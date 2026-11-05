import { Activity, BatteryMedium, Clock3, Gauge, Zap } from "lucide-react";
import { CYAN, clock, duration, fmt, signed, statusMeta } from "./format";

const Metric = ({ id, label, value, unit, icon: Icon, color = CYAN }) => (
  <div className="min-w-0 px-4 py-5 sm:px-5 border-b md:border-b-0 md:border-r last:border-r-0 border-white/[0.07]" data-testid={`smartshunt-metric-${id}`}>
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50"><Icon size={13} style={{ color }} /> {label}</div>
    <div className="mt-3 flex items-baseline gap-2 min-w-0">
      <span className="font-dseg text-3xl sm:text-4xl leading-none text-white break-all" style={{ textShadow: `0 0 12px ${color}55` }} data-testid={`smartshunt-${id}-value`}>{value}</span>
      <span className="font-mono text-sm text-white/45" data-testid={`smartshunt-${id}-unit`}>{unit}</span>
    </div>
  </div>
);

export const OverviewPanel = ({ payload }) => {
  const data = payload.current;
  const unavailable = data.status === "unavailable";
  const status = statusMeta(data.status);
  const direction = data.direction === "charging" ? "Laden" : data.direction === "discharging" ? "Entladen" : "Ruhe";
  const directionColor = data.direction === "charging" ? CYAN : data.direction === "discharging" ? "#F59E0B" : "#94A3B8";
  const soc = unavailable || data.soc_pct == null ? null : Math.max(0, Math.min(100, data.soc_pct));
  return (
    <div className="space-y-5" data-testid="smartshunt-overview-panel">
      <section className="overflow-hidden rounded-xl border border-cyan-400/20 bg-gradient-to-br from-[#0d1626] to-[#070c18]" data-testid="smartshunt-live-metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <Metric id="voltage" label="Spannung" value={fmt(unavailable ? null : data.voltage_v, 2)} unit="V" icon={Gauge} />
          <Metric id="current" label="Strom" value={signed(unavailable ? null : data.current_a, 2)} unit="A" icon={Activity} color={directionColor} />
          <Metric id="power" label="Leistung" value={signed(unavailable ? null : data.power_w, 0)} unit="W" icon={Zap} color={directionColor} />
          <Metric id="soc" label="Ladezustand" value={fmt(soc, 1)} unit="%" icon={BatteryMedium} color="#A3E635" />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-5" data-testid="smartshunt-operating-state">
        <div className="glass p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Batteriezustand</div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: directionColor }} data-testid="smartshunt-direction">{direction}</div>
            </div>
            <span className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.14em] ${status.className}`} data-testid="smartshunt-data-quality">{status.label} · {data.age_seconds == null ? "–" : `${fmt(data.age_seconds, 0)} s`}</span>
          </div>
          <div className="mt-6 h-2 rounded-full bg-black/50 overflow-hidden border border-white/10" data-testid="smartshunt-soc-track">
            <div className="h-full rounded-full transition-[width] duration-500 bg-gradient-to-r from-cyan-600 via-cyan-300 to-lime-300" style={{ width: `${soc || 0}%` }} data-testid="smartshunt-soc-fill" />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-white/35"><span>0 %</span><span data-testid="smartshunt-soc-inline">{fmt(soc, 1)} %</span><span>100 %</span></div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/[0.07] pt-4">
            <div><div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Restlaufzeit</div><div className="font-mono mt-1 text-white/85" data-testid="smartshunt-time-to-go">{duration(unavailable ? null : data.time_to_go_s)}</div></div>
            <div><div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Verbrauchte Ah</div><div className="font-mono mt-1 text-white/85" data-testid="smartshunt-consumed-ah">{fmt(unavailable ? null : data.consumed_ah, 1)} Ah</div></div>
            <div><div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Letzter Wert</div><div className="font-mono mt-1 text-white/85" data-testid="smartshunt-live-timestamp">{clock(data.last_update)}</div></div>
          </div>
        </div>

        <div className="glass p-5 sm:p-6 border-l-[3px] border-l-cyan-400/60">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Quellen-Trennung</div>
          <div className="mt-4 space-y-4">
            <div className="border-b border-white/[0.07] pb-4">
              <div className="font-semibold text-white" data-testid="smartshunt-source-role">SmartShunt · Batteriemessung</div>
              <div className="mt-1 text-sm text-white/55">Spannung · Strom · Leistung · SoC · Gerätehistorie</div>
            </div>
            <div>
              <div className="font-semibold text-amber-200" data-testid="trucki-source-role">Trucki / SUN-2000 · AC-Regelung</div>
              <div className="mt-1 text-sm text-white/55">Ausgang · Sollwert · Nulleinspeisung · Steuerung</div>
            </div>
          </div>
        </div>
      </section>

      {data.alerts?.length > 0 && (
        <section className="glass p-4 border-l-[3px] border-l-amber-400" data-testid="smartshunt-active-alerts">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">Aktive visuelle Hinweise</div>
          {data.alerts.map((alert) => <div key={alert.code} className="mt-2 text-sm text-white/75" data-testid={`smartshunt-alert-${alert.code}`}>{alert.label}</div>)}
        </section>
      )}
    </div>
  );
};