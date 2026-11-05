import { BatteryMedium, Gauge, Home, Zap } from "lucide-react";
import { duration, fmt, signed, statusMeta } from "../smartshunt/format";

const Metric = ({ id, label, value, unit, color, icon: Icon, source }) => <div className="min-w-0 border-b md:border-b-0 md:border-r last:border-r-0 border-white/[0.07] p-4" data-testid={`phase2-kpi-${id}`}>
  <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/45"><Icon size={12} style={{ color }} />{label}</span><span className="font-mono text-[8px]" style={{ color }}>{source}</span></div>
  <div className="mt-3"><span className="font-dseg text-3xl text-white" data-testid={`phase2-kpi-${id}-value`} style={{ textShadow: `0 0 12px ${color}55` }}>{value}</span><span className="ml-2 font-mono text-xs text-white/40">{unit}</span></div>
</div>;

export const Phase2Dashboard = ({ live }) => {
  const dc = live.battery_dc; const ac = live.inverter_ac; const sum = live.summary;
  const soc = dc.soc_pct == null ? 0 : Math.max(0, Math.min(100, dc.soc_pct));
  const state = statusMeta(dc.status);
  return <div className="space-y-5" data-testid="phase2-dashboard-view">
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b111d] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4" data-testid="phase2-kpi-strip">
      <Metric id="battery-dc" label="Batterie" value={signed(dc.power_w, 0)} unit="W" color="#06B6D4" icon={BatteryMedium} source="DC · SMARTSHUNT" />
      <Metric id="inverter-ac" label="SUN Ausgang" value={fmt(ac.output_w, 0)} unit="W" color="#8B5CF6" icon={Zap} source="AC · TRUCKI" />
      <Metric id="pv" label="PV gesamt" value={fmt(sum.pv_power, 0)} unit="W" color="#F59E0B" icon={Gauge} source="AC + DC" />
      <Metric id="house" label="Haus" value={fmt(sum.house_power, 0)} unit="W" color="#EC4899" icon={Home} source="AC-BILANZ" />
    </section>
    <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
      <section className="glass p-5 sm:p-6 border-l-[3px] border-l-cyan-400" data-testid="phase2-smartshunt-battery">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">Maßgebliche DC-Quelle</div><h2 className="mt-1 text-lg font-semibold">SmartShunt IP65 300A</h2></div><span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] ${state.className}`} data-testid="phase2-smartshunt-state">{state.label} · {dc.age_seconds == null ? "–" : `${fmt(dc.age_seconds, 0)} s`}</span></div>
        <div className="mt-6 flex items-end justify-between gap-4"><div><div className="font-mono text-[9px] uppercase text-white/40">Ladezustand</div><div className="mt-1 font-dseg text-5xl text-lime-300" data-testid="phase2-battery-soc">{fmt(dc.soc_pct, 1)}<span className="ml-2 font-mono text-sm text-white/40">%</span></div></div><div className="text-right font-mono text-xs text-white/55"><div data-testid="phase2-battery-voltage">{fmt(dc.voltage_v, 2)} V</div><div className="mt-1" data-testid="phase2-battery-current">{signed(dc.current_a, 2)} A</div><div className="mt-1" data-testid="phase2-battery-time">{duration(dc.time_to_go_s)}</div></div></div>
        <div className="mt-5 h-2 overflow-hidden rounded-full border border-white/10 bg-black/40"><div className="h-full bg-gradient-to-r from-cyan-600 via-cyan-300 to-lime-300 transition-[width] duration-500" style={{ width: `${soc}%` }} data-testid="phase2-battery-soc-fill" /></div>
        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs"><div className="border border-white/[0.07] bg-black/20 p-3 rounded"><div className="text-[9px] uppercase text-white/35">DC Laden</div><div className="mt-1 text-cyan-200" data-testid="phase2-dc-charge">{fmt(dc.charge_w, 0)} W</div></div><div className="border border-white/[0.07] bg-black/20 p-3 rounded"><div className="text-[9px] uppercase text-white/35">DC Entladen</div><div className="mt-1 text-cyan-200" data-testid="phase2-dc-discharge">{fmt(dc.discharge_w, 0)} W</div></div></div>
      </section>
      <section className="glass p-5 sm:p-6 border-l-[3px] border-l-violet-400" data-testid="phase2-trucki-ac-panel">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-violet-300">Alleinige AC-Regelquelle</div><h2 className="mt-1 text-lg font-semibold">Trucki / SUN-2000</h2>
        <div className="mt-5 font-dseg text-4xl text-violet-200" data-testid="phase2-ac-output">{fmt(ac.output_w, 0)}<span className="ml-2 font-mono text-sm text-white/40">W AC</span></div>
        <div className="mt-5 divide-y divide-white/[0.07] font-mono text-xs">{[["Sollwert", fmt(ac.setpoint_w,0)+" W","setpoint"],["Limit", fmt(ac.max_power_w,0)+" W","limit"],["ZEPC", ac.zepc ? "EIN" : "AUS","zepc"],["AC-Ausgang", ac.ac_output ? "EIN" : "AUS","state"]].map(([l,v,id])=><div key={id} className="flex justify-between gap-4 py-2.5"><span className="text-white/40">{l}</span><span className="text-white/85" data-testid={`phase2-ac-${id}`}>{v}</span></div>)}</div>
      </section>
    </div>
    <section className="glass p-4 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="phase2-source-contract"><div className="border-l-2 border-cyan-400 pl-3"><div className="font-mono text-[9px] uppercase text-cyan-300">Batterie · DC</div><div className="mt-1 text-sm text-white/65" data-testid="phase2-contract-battery">{live.source_contract.battery}</div></div><div className="border-l-2 border-violet-400 pl-3"><div className="font-mono text-[9px] uppercase text-violet-300">Wechselrichter · AC</div><div className="mt-1 text-sm text-white/65" data-testid="phase2-contract-inverter">{live.source_contract.inverter}</div></div></section>
    {live.alarms?.length>0&&<section className="glass border-l-[3px] border-l-amber-400 p-4" data-testid="phase2-active-alarms"><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">SmartShunt-Hinweise</div>{live.alarms.map(a=><div key={a.code} className="mt-2 text-sm text-white/70" data-testid={`phase2-alarm-${a.code}`}>{a.label}</div>)}</section>}
  </div>;
};