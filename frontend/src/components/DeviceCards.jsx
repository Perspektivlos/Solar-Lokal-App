/* Vier große Geräte-KPI-Karten (SCADA-Control-Room-Look) – ersetzen die
 * bisherige 6-Kachel-LCD-Leiste. Werte kommen aus dem Live-/Today-Payload.
 * Karten: Solar PV · Batterie 48V · Hausverbrauch · Stromnetz. */
import { Sun, BatteryCharging, Home, Cable } from "lucide-react";
import { COLOR, formatNum } from "./solar-ui";

const HOUSE_ACCENT = "#38bdf8";

function Badge({ label, color }) {
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold px-2 py-0.5 rounded-full border shrink-0"
      style={{ color, borderColor: `${color}66`, background: `${color}1a` }}
    >
      {label}
    </span>
  );
}

function SubRow({ label, value, sub, color, testid }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-t border-white/[0.06]" data-testid={testid}>
      <span className="font-mono text-[11px] text-white/55 truncate">{label}</span>
      <span className="font-mono text-[12px] whitespace-nowrap" style={{ color: color || "rgba(255,255,255,0.9)" }}>
        {value}
        {sub && <span className="text-white/35 text-[10px] ml-1">{sub}</span>}
      </span>
    </div>
  );
}

function DeviceCard({ accent, icon: Icon, title, desc, badge, bigValue, bigUnit, bigNote, rows, testid }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden h-full flex flex-col card-lift"
      data-testid={testid}
      style={{
        background: "linear-gradient(150deg, #0d1626 0%, #070c18 100%)",
        border: `1px solid ${accent}3a`,
        boxShadow: `inset 0 1px 0 rgba(226,232,240,0.05), 0 18px 44px -26px #000, 0 0 26px -14px ${accent}`,
      }}
    >
      <span className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 85%)`, boxShadow: `0 0 12px ${accent}` }} />
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center rounded-md shrink-0" style={{ width: 30, height: 30, background: `${accent}1f`, border: `1px solid ${accent}55` }}>
            <Icon size={16} color={accent} />
          </span>
          <div className="min-w-0">
            <div className="font-sans text-[12px] font-bold uppercase tracking-[0.16em] text-white/85 truncate">{title}</div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/40 truncate">{desc}</div>
          </div>
        </div>
        {badge && <Badge label={badge.label} color={badge.color} />}
      </div>
      <div className="px-4 pb-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-dseg text-[2.1rem] leading-none" style={{ color: accent, textShadow: `0 0 12px ${accent}88` }} data-testid={`${testid}-value`}>
            {bigValue}
          </span>
          <span className="font-mono text-xs text-white/40">{bigUnit}</span>
        </div>
        <div className="font-mono text-[10.5px] text-white/50 mt-1">{bigNote}</div>
      </div>
      <div className="px-4 pb-3 mt-1.5">
        {rows.map((r, i) => (
          <SubRow key={i} {...r} />
        ))}
      </div>
    </div>
  );
}

export default function DeviceCards({ live, today }) {
  const { shelly, ahoy, trucki, victron, summary } = live;
  const mppts = victron?.mppts || [];
  const phases = shelly?.phases || [];
  const grid = summary?.grid_power ?? 0;
  const battery = summary?.battery_power ?? 0;
  const importing = grid >= 0;

  const pvActive = (summary?.pv_power ?? 0) > 5;
  const battState = battery > 20 ? "Laden" : battery < -20 ? "Entladung" : "Leerlauf";
  const battCurrent = trucki?.battery_voltage ? battery / trucki.battery_voltage : 0;

  const cards = [
    {
      testid: "device-card-solar", accent: COLOR.pv, icon: Sun, title: "Solar PV", desc: "Hoymiles + 2× MPPT",
      badge: { label: pvActive ? "Aktiv" : "Inaktiv", color: pvActive ? COLOR.pv : "#64748b" },
      bigValue: formatNum(summary?.pv_power, 0), bigUnit: "W", bigNote: `Tagesertrag ${formatNum(today?.pv_kwh, 2)} kWh`,
      rows: [
        { label: "Hoymiles HM-1500", value: `${formatNum(ahoy?.total_power, 0)} W`, sub: `${formatNum(ahoy?.limit_percent, 0)} %`, color: COLOR.pv },
        { label: `${mppts[0]?.name || "Victron MPPT #1"} (DC)`, value: `${formatNum(mppts[0]?.pv_power, 0)} W` },
        { label: `${mppts[1]?.name || "Victron MPPT #2"} (DC)`, value: `${formatNum(mppts[1]?.pv_power, 0)} W` },
      ],
    },
    {
      testid: "device-card-battery", accent: COLOR.battery, icon: BatteryCharging, title: "Batterie 48V", desc: "6× Power Queen 100 Ah",
      badge: { label: `${formatNum(trucki?.soc, 0)} % SoC`, color: COLOR.battery },
      bigValue: formatNum(Math.abs(battery), 0), bigUnit: "W", bigNote: battState,
      rows: [
        { label: "Spannung / Strom", value: `${formatNum(trucki?.battery_voltage, 1)} V / ${formatNum(battCurrent, 1)} A`, color: COLOR.victron },
        { label: "Trucki Sun-2000", value: `${formatNum(trucki?.ac_display_w, 0)} W`, sub: `Lim ${formatNum(trucki?.max_power_w, 0)} W`, color: COLOR.pv },
        { label: "Tagesenergie", value: `${formatNum(trucki?.day_energy_kwh, 2)} kWh` },
      ],
    },
    {
      testid: "device-card-house", accent: HOUSE_ACCENT, icon: Home, title: "Hausverbrauch", desc: "AC-Lastbilanz",
      badge: { label: "Live", color: HOUSE_ACCENT },
      bigValue: formatNum(summary?.house_power, 0), bigUnit: "W", bigNote: `Tagesbedarf ${formatNum(today?.consumption_kwh, 2)} kWh`,
      rows: [
        { label: "Hoymiles (direkt)", value: `${formatNum(ahoy?.total_power, 0)} W`, color: COLOR.pv },
        { label: "Sun-2000 (aus Akku)", value: `${formatNum(summary?.battery_discharge_w, 0)} W`, color: COLOR.battery },
        { label: "Netz (Shelly 3EM)", value: `${importing ? "+" : "−"}${formatNum(Math.abs(grid), 0)} W`, sub: importing ? "Bezug" : "Einsp.", color: importing ? COLOR.grid_imp : COLOR.grid_exp },
      ],
    },
    {
      testid: "device-card-grid", accent: importing ? COLOR.grid_imp : COLOR.grid_exp, icon: Cable, title: "Stromnetz", desc: "Shelly Pro 3EM (L1/L2/L3)",
      badge: { label: importing ? "Bezug" : "Einspeisung", color: importing ? COLOR.grid_imp : COLOR.grid_exp },
      bigValue: formatNum(Math.abs(grid), 0), bigUnit: "W", bigNote: `Bezug ${formatNum(today?.grid_import_kwh, 2)} · Export ${formatNum(today?.grid_export_kwh, 2)} kWh`,
      rows: phases.map((p) => ({
        label: `${p.phase} (${formatNum(p.voltage, 1)} V)`,
        value: `${p.power >= 0 ? "+" : "−"}${formatNum(Math.abs(p.power), 0)} W`,
        color: p.power >= 0 ? COLOR.grid_imp : COLOR.grid_exp,
      })),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="device-cards">
      {cards.map((c) => <DeviceCard key={c.testid} {...c} />)}
    </div>
  );
}
