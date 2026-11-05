import { COLOR, formatNum, Spark } from "./solar-ui";
import { Sun } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

// Ziffern durch 8 ersetzen → „Geister-Segmente" hinter dem LCD-Wert.
const ghostDigits = (val) => String(val).replace(/[0-9]/g, "8");

// Min/Ø/Max der Sparkline-Datenreihe (letzte 15 Min) berechnen.
function sparkStats(values) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, avg };
}

// Obere KPI-Leiste: 6 Kacheln (Gesamt-kWh + Live-W) mit Sparkline-Trend.
export default function KpiStrip({ today, summary, trail }) {
  const cells = [
    { label: "Solar Ertrag Heute", icon: Sun, value: formatNum(today?.pv_kwh, 2), unit: "kWh", color: "text-orange-400 neon-text-orange", accent: "#F59E0B", spark: trail.pv, sparkColor: "#F59E0B", testid: "kpi-pv-total" },
    { label: "Solar Erzeugung", value: formatNum(summary.pv_power, 0), unit: "W", color: "text-yellow-300 neon-text-yellow", accent: COLOR.pv, spark: trail.pv, sparkColor: COLOR.pv, testid: "kpi-pv-now" },
    { label: "Netzbezug Heute", value: formatNum(today?.grid_import_kwh, 2), unit: "kWh", color: "text-red-300 neon-text-red", accent: COLOR.grid_imp, spark: trail.grid, sparkColor: COLOR.grid_imp, testid: "kpi-grid-import" },
    { label: "Hauslast", value: formatNum(summary?.house_power, 0), unit: "W", color: "text-white", accent: COLOR.house, spark: trail.house, sparkColor: COLOR.house, testid: "kpi-house-load" },
    { label: "Verbrauch (Gesamt)", value: formatNum(today?.consumption_kwh, 2), unit: "kWh", color: "text-white", accent: COLOR.house, spark: trail.house, sparkColor: COLOR.house, testid: "kpi-consumption" },
    { label: "Einspeisung (Gesamt)", value: formatNum(today?.grid_export_kwh, 2), unit: "kWh", color: "text-emerald-300 neon-text-green", accent: COLOR.grid_exp, spark: trail.grid, sparkColor: COLOR.grid_exp, testid: "kpi-grid-export-total" },
  ];

  const renderCell = (m) => (
    <div className="kpi-cell relative p-5 h-full cursor-default" data-testid={m.testid}>
      <span className="absolute top-0 left-0 right-0 h-[2px] opacity-90 pointer-events-none" style={{ background: `linear-gradient(90deg, ${m.accent}, transparent 88%)`, boxShadow: `0 0 12px ${m.accent}, 0 1px 6px ${m.accent}aa` }} />
      <span className="absolute top-[2px] left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, rgba(226,232,240,0.28), transparent 68%)" }} />
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 flex items-center gap-1.5">
        <span>{m.label}</span>
        {m.icon && <m.icon size={11} strokeWidth={2.4} style={{ color: m.accent }} />}
      </div>
      <div className="relative mt-2 rounded-md px-2.5 py-2 overflow-hidden" style={{ background: "rgba(2,6,14,0.72)", border: "1px solid rgba(148,163,184,0.09)", boxShadow: "inset 0 2px 12px rgba(0,0,0,0.75)" }}>
        <div className="relative leading-none" style={{ height: "1.95rem" }}>
          <span className="font-dseg absolute inset-0 text-[1.9rem] leading-none select-none" style={{ color: m.accent, opacity: 0.06 }} aria-hidden>{ghostDigits(m.value)}</span>
          <span className={`font-dseg relative text-[1.9rem] leading-none ${m.color}`}>{m.value}</span>
          <span className="font-mono text-xs ml-1.5 text-white/40 align-top">{m.unit}</span>
        </div>
      </div>
      {m.spark && m.spark.length > 1 && <div className="mt-2"><Spark values={m.spark} color={m.sparkColor} height={20} /></div>}
    </div>
  );

  return (
    <TooltipProvider delayDuration={120}>
      <div className="glass overflow-hidden grid grid-cols-2 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-white/[0.07]" data-testid="top-kpi">
        {cells.map((m) => {
          const stats = sparkStats(m.spark);
          if (!stats) return <div key={m.label} className="contents">{renderCell(m)}</div>;
          return (
            <Tooltip key={m.label}>
              <TooltipTrigger asChild>{renderCell(m)}</TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={8}
                data-testid={`${m.testid}-tooltip`}
                className="border border-white/15 text-white shadow-2xl px-3 py-2"
                style={{ background: "rgba(11, 18, 38, 0.96)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
              >
                <div className="font-sans text-[9px] uppercase tracking-[0.18em] text-white/45 mb-1">Letzte 15 Min</div>
                <div className="font-mono text-[11px] flex items-center gap-3">
                  <span className="text-white/70">Ø <span className="text-white">{formatNum(stats.avg, 0)}</span></span>
                  <span className="text-emerald-300">Max {formatNum(stats.max, 0)}</span>
                  <span className="text-red-300">Min {formatNum(stats.min, 0)}</span>
                  <span className="text-white/40">W</span>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
