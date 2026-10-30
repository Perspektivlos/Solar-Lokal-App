/* Gruppierte Tages-kWh-Balken aus /api/energy/balance. */
import { useEffect, useState } from "react";
import { BarChart2, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { getEnergyBalance } from "../../lib/api";
import { CH, EXPORT_COLOR, GRID_STROKE, TICK } from "./shared";

const SERIES = [
  { key: "pv_kwh", name: "PV-Ertrag", color: CH.pv.color },
  { key: "self_kwh", name: "Eigenverbrauch", color: CH.house.color },
  { key: "import_kwh", name: "Netzbezug", color: CH.grid.color },
  { key: "export_kwh", name: "Einspeisung", color: EXPORT_COLOR },
];

const dayLabel = (id) => {
  const [, month, day] = String(id || "").split("-");
  return day && month ? `${day}.${month}.` : id;
};

const tooltipStyle = { background: "#090d16", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, fontSize: 11 };

export default function BalanceHistoryBars() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [chartKey, setChartKey] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = (showLoading = false) => {
      if (showLoading) setLoading(true);
      getEnergyBalance("day", 14)
        .then((d) => {
          if (!alive) return;
          setRows((d.buckets || []).map((b) => ({ ...b, label: dayLabel(b.period) })));
          setError(false);
        })
        .catch(() => { if (alive) setError(true); })
        .finally(() => { if (alive) setLoading(false); });
    };
    load(true);
    const timer = setInterval(() => load(false), 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [retryKey]);

  useEffect(() => {
    let timer;
    const resetTooltip = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setChartKey((key) => key + 1), 120);
    };
    window.addEventListener("resize", resetTooltip);
    return () => { clearTimeout(timer); window.removeEventListener("resize", resetTooltip); };
  }, []);

  return (
    <div className="mt-5 pt-5 border-t border-white/[0.06] overflow-hidden" data-testid="vp-balance-history-bars">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-white">
          <BarChart2 size={15} className="text-amber-300" /> Tageswerte · letzte 14 Tage
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45" data-testid="vp-balance-history-unit">kWh pro Tag</span>
      </div>
      <div className="h-[250px] sm:h-[290px]" data-testid="vp-balance-history-plot">
        {loading ? (
          <div className="h-full grid place-items-center font-mono text-xs text-white/40" data-testid="vp-balance-history-loading">Lade Tageswerte…</div>
        ) : error ? (
          <div className="h-full grid place-items-center text-center" role="alert" data-testid="vp-balance-history-error">
            <div>
              <div className="font-mono text-xs text-rose-300">Tageswerte konnten nicht geladen werden.</div>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.04] font-mono text-[11px] text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors" data-testid="vp-balance-history-retry">
                <RefreshCw size={12} /> Erneut laden
              </button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="h-full grid place-items-center font-mono text-xs text-white/40" data-testid="vp-balance-history-empty">Noch keine Tageswerte vorhanden.</div>
        ) : (
          <ResponsiveContainer key={chartKey}>
            <BarChart data={rows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barGap={1}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={TICK} stroke="rgba(255,255,255,0.12)" minTickGap={12} />
              <YAxis tick={TICK} stroke="rgba(255,255,255,0.12)" tickFormatter={(v) => `${v} kWh`} width={68} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`, name]} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
              {SERIES.map((series) => <Bar key={series.key} dataKey={series.key} name={series.name} fill={series.color} radius={[2, 2, 0, 0]} maxBarSize={18} />)}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}