import { Activity, ShieldCheck } from "lucide-react";
import { DevicePanel } from "../smartshunt/DevicePanel";
import { fmt } from "../smartshunt/format";
import { Link } from "react-router-dom";

export const Phase2Devices = ({ live, diagnosticsPath = "/smartshunt-phase2/diagnose" }) => <div className="space-y-5" data-testid="phase2-devices-view">
  <DevicePanel payload={{ current: live.smartshunt }} />
  <section className="glass overflow-hidden border-l-[3px] border-l-violet-400" data-testid="phase2-trucki-device">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]"><Activity size={14} className="text-violet-300" /> Trucki2Shelly / SUN-2000</div><span className="font-mono text-[9px] uppercase text-violet-300">AC-Regelgateway</span></div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-white/[0.06]">{[["AC Ist",live.inverter_ac.output_w,"W","output"],["Sollwert",live.inverter_ac.setpoint_w,"W","target"],["Minimum",live.inverter_ac.min_power_w,"W","min"],["Maximum",live.inverter_ac.max_power_w,"W","max"],["Temperatur",live.inverter_ac.temperature_c,"°C","temp"]].map(([label,value,unit,id])=><div key={id} className="bg-[#0a0f19] p-4"><div className="font-mono text-[9px] uppercase text-white/35">{label}</div><div className="mt-1 font-mono text-lg text-white/85" data-testid={`phase2-trucki-${id}`}>{fmt(value,id==="temp"?1:0)} <span className="text-xs text-white/35">{unit}</span></div></div>)}</div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4"><div className="text-sm text-white/50">Keine Batterie-V/A/W/SoC-Werte werden aus Trucki übernommen.</div><Link to={diagnosticsPath} data-testid="phase2-device-open-diagnostics" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase text-cyan-300 hover:text-cyan-100"><ShieldCheck size={13} /> Hardwareprüfung öffnen</Link></div>
  </section>
</div>;