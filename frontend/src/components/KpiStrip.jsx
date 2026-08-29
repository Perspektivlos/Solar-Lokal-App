import { COLOR, formatNum, Spark } from "./solar-ui";
import { exportNowW, isExporting } from "../lib/power";

/**
 * Rendert eine sechs Kacheln umfassende KPI-Leiste für Solar- und Haushaltsenergiewerte.
 * @param {Object} today - Tageswerte für Energieerzeugung, Netzbezug, Verbrauch und Einspeisung.
 * @param {Object} summary - Aktuelle Leistungswerte für PV-Anlage und Netz.
 * @param {Object} trail - Historische Messwerte für optionale Sparkline-Trends.
 * @return {JSX.Element} Die gerenderte KPI-Leiste.
 */
export default function KpiStrip({ today, summary, trail }) {
  const exportNow = exportNowW(summary);
  const exporting = isExporting(summary);
  // Aktuellen Grid je nach aktivem Status anzeigen: Netz-Bezug (rot) vs. Netz-Einspeisung (grün).
  const gridNow = exporting
    ? { label: "Netz Einspeisung (Aktuell)", value: formatNum(exportNow, 0), color: "text-emerald-300 neon-text-green", accent: COLOR.grid_exp }
    : { label: "Netz Bezug (Aktuell)", value: formatNum(Math.max(0, summary?.grid_power || 0), 0), color: "text-red-300 neon-text-red", accent: COLOR.grid_imp };
  const cells = [
    { label: "PV Gesamt", value: formatNum(today?.pv_kwh, 2), unit: "kWh", color: "text-yellow-300 neon-text-yellow", accent: COLOR.pv, spark: trail.pv, sparkColor: COLOR.pv, testid: "kpi-pv-total" },
    { label: "PV Aktuell", value: formatNum(summary.pv_power, 0), unit: "W", color: "text-yellow-300 neon-text-yellow", accent: COLOR.pv, spark: trail.pv, sparkColor: COLOR.pv, testid: "kpi-pv-now" },
    { label: "Netz Bezug (Gesamt)", value: formatNum(today?.grid_import_kwh, 2), unit: "kWh", color: "text-red-300 neon-text-red", accent: COLOR.grid_imp, spark: trail.grid, sparkColor: COLOR.grid_imp, testid: "kpi-grid-import" },
    { label: gridNow.label, value: gridNow.value, unit: "W", color: gridNow.color, accent: gridNow.accent, spark: trail.grid, sparkColor: gridNow.accent, testid: "kpi-grid-now" },
    { label: "Verbrauch (Gesamt)", value: formatNum(today?.consumption_kwh, 2), unit: "kWh", color: "text-white", accent: COLOR.house, spark: trail.house, sparkColor: COLOR.house, testid: "kpi-consumption" },
    { label: "Einspeisung (Gesamt)", value: formatNum(today?.grid_export_kwh, 2), unit: "kWh", color: "text-emerald-300 neon-text-green", accent: COLOR.grid_exp, testid: "kpi-grid-export-total" },
  ];
  return (
    <div className="glass overflow-hidden grid grid-cols-2 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-white/[0.07]" data-testid="top-kpi">
      {cells.map((m) => (
        <div key={m.label} className="relative p-4 transition-colors hover:bg-white/[0.02]" data-testid={m.testid}>
          <span className="absolute top-0 left-0 right-0 h-[2px] opacity-90 pointer-events-none" style={{ background: `linear-gradient(90deg, ${m.accent}, transparent 88%)`, boxShadow: `0 0 12px ${m.accent}, 0 1px 6px ${m.accent}aa` }} />
          <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{m.label}</div>
          <div className={`font-mono text-2xl lg:text-3xl font-semibold tracking-tight leading-none mt-1.5 ${m.color}`}>
            {m.value}<span className="text-sm ml-1 text-white/45 font-normal">{m.unit}</span>
          </div>
          {m.spark && m.spark.length > 1 && <div className="mt-2"><Spark values={m.spark} color={m.sparkColor} height={20} /></div>}
        </div>
      ))}
    </div>
  );
}
