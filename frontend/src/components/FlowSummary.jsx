/* Kennzahlen-Zeile unter dem Energiefluss: vier Zusammenfassungs-Kacheln.
 * Solar Ertrag Heute · Batterie Kapazität · Netzbezug Heute · Autarkiegrad. */
import { Sun, BatteryCharging, Cable, Gauge } from "lucide-react";
import { COLOR, formatNum } from "./solar-ui";

// Fallback-Kapazität, falls keine Einstellung gesetzt ist.
const DEFAULT_USABLE_KWH = 9.6;

function Tile({ accent, icon: Icon, label, value, unit, sub, testid }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden px-4 py-3.5"
      data-testid={testid}
      style={{
        background: "linear-gradient(150deg, #0c1526 0%, #070c18 100%)",
        border: `1px solid ${accent}33`,
        boxShadow: `inset 0 1px 0 rgba(226,232,240,0.05), 0 16px 38px -28px #000, 0 0 20px -12px ${accent}`,
      }}
    >
      <span className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 85%)`, boxShadow: `0 0 10px ${accent}` }} />
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} color={accent} />
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60" data-testid={`${testid}-label`}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-dseg text-[1.7rem] leading-none" style={{ color: accent, textShadow: `0 0 10px ${accent}88` }} data-testid={`${testid}-value`}>
          {value}
        </span>
        <span className="font-mono text-[11px] text-white/40" data-testid={`${testid}-unit`}>{unit}</span>
      </div>
      <div className="font-mono text-[10px] text-white/45 mt-1.5" data-testid={`${testid}-source`}>{sub}</div>
    </div>
  );
}

export default function FlowSummary({ live, today, usableKwh }) {
  const s = live?.summary || {};
  const cap = usableKwh > 0 ? usableKwh : DEFAULT_USABLE_KWH;
  const grid = s.grid_power ?? 0;
  const house = s.house_power ?? 0;
  const soc = s.battery_soc ?? 0;
  const importing = grid >= 0;
  const battKwh = (soc / 100) * cap;
  // Momentane Eigenabdeckung des Hausverbrauchs aus eigener Erzeugung.
  const instantCover = house <= 0 ? 100 : Math.max(0, Math.min(100, ((house - Math.max(0, grid)) / house) * 100));
  // Verlässlicher Tagesertrag: Integration der gespeicherten PV-Leistung seit 00:00 UTC.
  // Die Geräte-YDay-Zähler sind im Demo-Modus Momentwerte und daher kein Tagesertrag.
  const pvTodayKwh = today?.pv_kwh;
  const measuredLabel = live?.demo_mode ? "Simulierter Messverlauf seit 00:00 UTC" : "Messverlauf seit 00:00 UTC";

  const tiles = [
    { testid: "summary-pv", accent: "#F59E0B", icon: Sun, label: "Solarertrag heute", value: formatNum(pvTodayKwh, 2), unit: "kWh", sub: measuredLabel },
    { testid: "summary-battery", accent: COLOR.battery, icon: BatteryCharging, label: "Akku verfügbar", value: formatNum(battKwh, 2), unit: "kWh", sub: `${formatNum(soc, 0)} % SoC von ${formatNum(cap, 1)} kWh nutzbar · Schätzwert` },
    { testid: "summary-grid", accent: importing ? COLOR.grid_imp : COLOR.grid_exp, icon: Cable, label: "Netzbezug heute", value: formatNum(today?.grid_import_kwh, 2), unit: "kWh", sub: `${measuredLabel} · aktuell ${importing ? "+" : "−"}${formatNum(Math.abs(grid), 0)} W` },
    { testid: "summary-autarky", accent: COLOR.grid_exp, icon: Gauge, label: "Autarkie heute", value: formatNum(today?.autarky_pct, 1), unit: "%", sub: `Tageswert · aktuell ${formatNum(instantCover, 0)} % Eigenabdeckung` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="flow-summary">
      {tiles.map((t) => <Tile key={t.testid} {...t} />)}
    </div>
  );
}
