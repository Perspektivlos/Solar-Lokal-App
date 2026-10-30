/* Erweiterte Tages-Energiebilanz (kWh): vier Karten + zwei Verteilungsbalken. */
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, ShieldCheck, Sun, Zap, BatteryCharging, Activity } from "lucide-react";
import { formatNum } from "../solar-ui";
import { CH, CARD, EXPORT_COLOR } from "./shared";
import BalanceHistoryBars from "./BalanceHistoryBars";

const kwh = (v) => `${formatNum(v, 2)} kWh`;
const pct = (v) => `${formatNum(v, 1)}%`;

const finite = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function Delta({ value, previous, mode = "kwh", testid }) {
  if (!finite(value) || !finite(previous)) return <span className="text-white/35" data-testid={testid}>Gestern: –</span>;
  const diff = Number(value) - Number(previous);
  const same = Math.abs(diff) < (mode === "pct" ? 0.05 : 0.005);
  const Icon = same ? ArrowRight : diff > 0 ? ArrowUpRight : ArrowDownRight;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const abs = Math.abs(diff);
  const relative = Number(previous) !== 0 ? `${sign}${formatNum(Math.abs((diff / Number(previous)) * 100), 1)}%` : null;
  const amount = mode === "pct" ? `${sign}${formatNum(abs, 1)} %-Pkt.` : `${sign}${formatNum(abs, 2)} kWh`;
  return (
    <span className={`inline-flex items-center gap-1 ${same ? "text-white/45" : diff > 0 ? "text-cyan-300" : "text-amber-300"}`} data-testid={testid}>
      <Icon size={11} /> {same ? "unverändert" : amount}{relative && mode !== "pct" ? ` · ${relative}` : ""} ggü. gestern
    </span>
  );
}

function BalanceCard({ color, icon: Icon, title, badge, value, previous, unit, rows, testid }) {
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
      <div className="mt-2 font-mono text-[10px]"><Delta value={value} previous={previous} testid={`${testid}-delta`} /></div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 font-mono text-[11px]">
            <span className="text-white/55 pt-0.5">{r.label}</span>
            <span className="text-right min-w-0">
              <span className="block font-semibold" style={{ color: r.color || "#fff" }} data-testid={`${testid}-row-${slug(r.label)}-value`}>{r.value}</span>
              <span className="block mt-0.5 text-[9.5px]"><Delta value={r.raw} previous={r.previous} mode={r.mode} testid={`${testid}-row-${slug(r.label)}-delta`} /></span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistBar({ title, titleColor, total, ratioLabel, ratio, previousRatio, segments, testid }) {
  const sum = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const shares = segments.map((s) => (sum > 0 ? (Math.max(0, s.value) / sum) * 100 : 0));
  const rounded = shares.map(Math.round);
  if (sum > 0) rounded[rounded.indexOf(Math.max(...rounded))] += 100 - rounded.reduce((a, b) => a + b, 0);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4" data-testid={testid}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold" style={{ color: titleColor }}>{title} ({formatNum(total, 2)} kWh = 100%)</span>
        <span className="font-mono text-[11px] text-white/55 text-right" data-testid={`${testid}-ratio`}>
          <span className="block">{ratioLabel}</span>
          <span className="block mt-0.5 text-[9.5px]"><Delta value={ratio} previous={previousRatio} mode="pct" testid={`${testid}-ratio-delta`} /></span>
        </span>
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
      {sum > total * 1.02 && (
        <div className="mt-2 font-mono text-[10px] text-amber-300/80" data-testid={`${testid}-hint`}>
          Hinweis: Akku-Ladung + Einspeisung ({formatNum(sum, 2)} kWh) liegen über dem Gerätezähler – Anteile beziehen sich auf diese Summe.
        </div>
      )}
    </div>
  );
}

function valuesFor(day, pvValue) {
  if (!day) {
    return {
      pv: null, charge: null, discharge: null, imp: null, exp: null, direct: null,
      house: null, selfUse: null, autarky: null, net: null, roundTrip: null,
    };
  }
  const pv = finite(pvValue) ? Number(pvValue) : Number(day?.pv_kwh || 0);
  const charge = Number(day?.battery_charge_kwh || 0);
  const discharge = Number(day?.battery_discharge_kwh || 0);
  const imp = Number(day?.grid_import_kwh || 0);
  const exp = Number(day?.grid_export_kwh || 0);
  const direct = Math.max(0, pv - charge - exp);
  const house = direct + discharge + imp;
  return {
    pv, charge, discharge, imp, exp, direct, house,
    selfUse: pv > 0 ? Math.max(0, ((pv - exp) / pv) * 100) : 0,
    autarky: house > 0 ? ((house - imp) / house) * 100 : 0,
    net: imp - exp,
    roundTrip: Number(day?.round_trip_pct || 0),
  };
}

export default function DayBalance({ live, today, yesterday }) {
  const ahoy = live?.ahoy || {};
  const hoy = ahoy.yield_day_kwh ?? (ahoy.channels || []).reduce((a, c) => a + (c.yield_day || 0), 0);
  const mppt = (live?.victron?.mppts || []).reduce((a, m) => a + (m.yield_today || 0), 0);
  const current = valuesFor(today, hoy + mppt);
  const previous = valuesFor(yesterday);
  const { pv, charge, discharge, imp, exp, direct, house, selfUse, autarky, net, roundTrip } = current;

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
          <ShieldCheck size={14} /> <span>Autarkie Heute: <b className="text-white">{pct(autarky)}</b><span className="block text-[9.5px]"><Delta value={autarky} previous={previous.autarky} mode="pct" testid="vp-autarky-delta" /></span></span>
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <BalanceCard color={CH.pv.color} icon={Sun} title="PV-Ertrag Heute" badge="Erzeugung" value={pv} previous={previous.pv} unit="kWh" testid="vp-bal-pv"
          rows={[{ label: "Direktverbrauch:", value: kwh(direct), raw: direct, previous: previous.direct }, { label: "In Akku geladen:", value: kwh(charge), raw: charge, previous: previous.charge, color: CH.battery.color }, { label: "Netzeinspeisung:", value: kwh(exp), raw: exp, previous: previous.exp, color: EXPORT_COLOR }]} />
        <BalanceCard color={CH.house.color} icon={Zap} title="Hausverbrauch Gesamt" badge="Bedarf" value={house} previous={previous.house} unit="kWh" testid="vp-bal-house"
          rows={[{ label: "Aus Solar direkt:", value: kwh(direct), raw: direct, previous: previous.direct, color: CH.pv.color }, { label: "Aus Batteriespeicher:", value: kwh(discharge), raw: discharge, previous: previous.discharge, color: CH.battery.color }, { label: "Aus öffentlichem Netz:", value: kwh(imp), raw: imp, previous: previous.imp, color: CH.grid.color }]} />
        <BalanceCard color={CH.battery.color} icon={BatteryCharging} title="Speicherumsatz (48V)" badge="LiFePO4" value={discharge} previous={previous.discharge} unit="kWh entl." testid="vp-bal-battery"
          rows={[{ label: "Ladung kumuliert:", value: kwh(charge), raw: charge, previous: previous.charge }, { label: "Entladung (Sun-2000):", value: kwh(discharge), raw: discharge, previous: previous.discharge }, { label: "Round-Trip Wirkungsgrad:", value: roundTrip ? pct(roundTrip) : "–", raw: roundTrip, previous: previous.roundTrip, mode: "pct", color: EXPORT_COLOR }]} />
        <BalanceCard color={CH.grid.color} icon={Activity} title="Netzübertritt (Shelly)" badge="Saldierend" value={imp} previous={previous.imp} unit="kWh Bezug" testid="vp-bal-grid"
          rows={[{ label: "Netzbezug Heute:", value: `+${kwh(imp)}`, raw: imp, previous: previous.imp, color: CH.grid.color }, { label: "Netzeinspeisung:", value: `−${kwh(exp)}`, raw: exp, previous: previous.exp, color: EXPORT_COLOR }, { label: "Netto-Netzsaldo:", value: `${net >= 0 ? "+" : "−"}${kwh(Math.abs(net))}`, raw: net, previous: previous.net }]} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistBar title="Verteilung des Solarertrags" titleColor={CH.pv.color} total={pv} ratioLabel={`Eigenverbrauch: ${pct(selfUse)}`} ratio={selfUse} previousRatio={previous.selfUse} testid="vp-dist-pv"
          segments={[{ label: "Direkt", value: direct, color: CH.pv.color }, { label: "Akku", value: charge, color: CH.battery.color }, { label: "Netz", value: exp, color: EXPORT_COLOR }]} />
        <DistBar title="Deckung des Hausverbrauchs" titleColor={CH.house.color} total={house} ratioLabel={`Autarkie: ${pct(autarky)}`} ratio={autarky} previousRatio={previous.autarky} testid="vp-dist-house"
          segments={[{ label: "Solar", value: direct, color: CH.pv.color }, { label: "Akku", value: discharge, color: CH.battery.color }, { label: "Netz", value: imp, color: CH.grid.color }]} />
      </div>
      <BalanceHistoryBars />
    </div>
  );
}
