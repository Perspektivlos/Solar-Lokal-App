/* Erweiterte Tages-Energiebilanz (kWh): vier Karten + zwei Verteilungsbalken. */
import { BarChart3, ShieldCheck, Sun, Zap, BatteryCharging, Activity } from "lucide-react";
import { formatNum } from "../solar-ui";
import { CH, CARD, EXPORT_COLOR } from "./shared";

const kwh = (v) => `${formatNum(v, 2)} kWh`;
const pct = (v) => `${formatNum(v, 1)}%`;

function BalanceCard({ color, icon: Icon, title, badge, value, unit, rows, testid }) {
  return (
    <div className="rounded-xl p-4 bg-black/20" style={{ border: `1px solid ${color}40` }} data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold min-w-0" style={{ color }}>
          <Icon size={14} className="shrink-0" /> <span className="truncate">{title}</span>
        </div>
        <span className="px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0" style={{ color, background: `${color}1f` }}>{badge}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2 pb-3 border-b border-white/[0.06]">
        <span className="font-mono text-2xl font-bold text-white" data-testid={`${testid}-value`}>{formatNum(value, 2)}</span>
        <span className="font-mono text-[13px]" style={{ color }}>{unit}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 font-mono text-[11px]">
            <span className="text-white/55">{r.label}</span>
            <span className="font-semibold" style={{ color: r.color || "#fff" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistBar({ title, titleColor, total, ratioLabel, segments, testid }) {
  const sum = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const shares = segments.map((s) => (sum > 0 ? (Math.max(0, s.value) / sum) * 100 : 0));
  const rounded = shares.map(Math.round);
  if (sum > 0) rounded[rounded.indexOf(Math.max(...rounded))] += 100 - rounded.reduce((a, b) => a + b, 0);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4" data-testid={testid}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold" style={{ color: titleColor }}>{title} ({formatNum(total, 2)} kWh = 100%)</span>
        <span className="font-mono text-[11px] text-white/55">{ratioLabel}</span>
      </div>
      <div className="mt-3 h-2.5 rounded-full overflow-hidden flex bg-white/[0.06]">
        {segments.map((s, i) => <div key={s.label} className="h-full transition-[width] duration-500" style={{ width: `${shares[i]}%`, background: s.color }} />)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] text-white/70">
        {segments.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1.5" data-testid={`${testid}-${s.label.toLowerCase()}`}>
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.label}: {sum > 0 ? rounded[i] : 0}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DayBalance({ live, today }) {
  const ahoy = live?.ahoy || {};
  const hoy = ahoy.yield_day_kwh ?? (ahoy.channels || []).reduce((a, c) => a + (c.yield_day || 0), 0);
  const mppt = (live?.victron?.mppts || []).reduce((a, m) => a + (m.yield_today || 0), 0);
  const pv = hoy + mppt;
  const charge = today?.battery_charge_kwh || 0;
  const discharge = today?.battery_discharge_kwh || 0;
  const imp = today?.grid_import_kwh || 0;
  const exp = today?.grid_export_kwh || 0;
  const direct = Math.max(0, pv - charge - exp);
  const house = direct + discharge + imp;
  const selfUse = pv > 0 ? Math.max(0, ((pv - exp) / pv) * 100) : 0;
  const autarky = house > 0 ? ((house - imp) / house) * 100 : 0;
  const net = imp - exp;

  return (
    <div className={`${CARD} p-4 sm:p-6`} data-testid="vp-balance">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase tracking-[0.04em] text-[13px] text-white">
            <BarChart3 size={15} className="text-emerald-300" /> Tages-Energiebilanz in Kilowattstunden (kWh)
          </div>
          <div className="text-[11px] text-white/45 mt-0.5">Vollständige Bilanzierung des Energieflusses: Erzeugung, Speicherung, Netzbezug und Verbrauch</div>
        </div>
        <span className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 font-mono text-[12px] text-emerald-300" data-testid="vp-autarky-badge">
          <ShieldCheck size={14} /> Autarkie Heute: <b className="text-white">{pct(autarky)}</b>
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <BalanceCard color={CH.pv.color} icon={Sun} title="PV-Ertrag Heute" badge="Erzeugung" value={pv} unit="kWh" testid="vp-bal-pv"
          rows={[{ label: "Direktverbrauch:", value: kwh(direct) }, { label: "In Akku geladen:", value: kwh(charge), color: CH.battery.color }, { label: "Netzeinspeisung:", value: kwh(exp), color: EXPORT_COLOR }]} />
        <BalanceCard color={CH.house.color} icon={Zap} title="Hausverbrauch Gesamt" badge="Bedarf" value={house} unit="kWh" testid="vp-bal-house"
          rows={[{ label: "Aus Solar direkt:", value: kwh(direct), color: CH.pv.color }, { label: "Aus Batteriespeicher:", value: kwh(discharge), color: CH.battery.color }, { label: "Aus öffentlichem Netz:", value: kwh(imp), color: CH.grid.color }]} />
        <BalanceCard color={CH.battery.color} icon={BatteryCharging} title="Speicherumsatz (48V)" badge="LiFePO4" value={discharge} unit="kWh entl." testid="vp-bal-battery"
          rows={[{ label: "Ladung kumuliert:", value: kwh(charge) }, { label: "Entladung (Sun-2000):", value: kwh(discharge) }, { label: "Round-Trip Wirkungsgrad:", value: today?.round_trip_pct ? pct(today.round_trip_pct) : "–", color: EXPORT_COLOR }]} />
        <BalanceCard color={CH.grid.color} icon={Activity} title="Netzübertritt (Shelly)" badge="Saldierend" value={imp} unit="kWh Bezug" testid="vp-bal-grid"
          rows={[{ label: "Netzbezug Heute:", value: `+${kwh(imp)}`, color: CH.grid.color }, { label: "Netzeinspeisung:", value: `−${kwh(exp)}`, color: EXPORT_COLOR }, { label: "Netto-Netzsaldo:", value: `${net >= 0 ? "+" : "−"}${kwh(Math.abs(net))}` }]} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistBar title="Verteilung des Solarertrags" titleColor={CH.pv.color} total={pv} ratioLabel={`Eigenverbrauch: ${pct(selfUse)}`} testid="vp-dist-pv"
          segments={[{ label: "Direkt", value: direct, color: CH.pv.color }, { label: "Akku", value: charge, color: CH.battery.color }, { label: "Netz", value: exp, color: EXPORT_COLOR }]} />
        <DistBar title="Deckung des Hausverbrauchs" titleColor={CH.house.color} total={house} ratioLabel={`Autarkie: ${pct(autarky)}`} testid="vp-dist-house"
          segments={[{ label: "Solar", value: direct, color: CH.pv.color }, { label: "Akku", value: discharge, color: CH.battery.color }, { label: "Netz", value: imp, color: CH.grid.color }]} />
      </div>
    </div>
  );
}
