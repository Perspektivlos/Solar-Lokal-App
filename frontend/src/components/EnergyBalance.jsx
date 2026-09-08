/* Energiebilanz: kWh-Balken (PV-Ertrag, Bezug, Einspeisung, Eigenverbrauch)
   je Tag oder Monat. Datenquelle: /api/energy/balance. */
import { useEffect, useState } from "react";
import { getEnergyBalance } from "../lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { BarChart2 } from "lucide-react";

const SERIES = [
  { key: "pv_kwh", name: "PV-Ertrag", color: "#FACC15" },
  { key: "import_kwh", name: "Bezug", color: "#F87171" },
  { key: "export_kwh", name: "Einspeisung", color: "#34D399" },
  { key: "self_kwh", name: "Eigenverbrauch", color: "#06B6D4" },
];

function label(period, id) {
  if (period === "month") {
    const [y, m] = id.split("-");
    const names = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    return `${names[parseInt(m, 10) - 1] || m} ${y.slice(2)}`;
  }
  const [, m, d] = id.split("-");
  return `${d}.${m}.`;
}

const TICK = { fill: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "monospace" };
const TOOLTIP_STYLE = { background: "rgba(11,16,28,0.95)", border: "1px solid rgba(148,163,201,0.25)", borderRadius: 8, fontSize: 12 };

export default function EnergyBalance() {
  const [period, setPeriod] = useState("day");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getEnergyBalance(period, period === "day" ? 14 : 6)
      .then((d) => setRows((d.buckets || []).map((b) => ({ ...b, label: label(period, b.period) }))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="glass" data-testid="energy-balance" style={{ borderLeft: "3px solid #FACC15" }}>
      <div className="border-b border-white/10 px-4 py-2 flex items-center gap-2 flex-wrap">
        <BarChart2 size={14} className="text-yellow-300" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">Energiebilanz (kWh)</span>
        <div className="ml-auto flex glass overflow-hidden" data-testid="balance-period-toggle">
          {[["day", "Tag"], ["month", "Monat"]].map(([val, txt]) => (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              data-testid={`balance-period-${val}`}
              aria-pressed={period === val}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] border-l border-white/10 first:border-l-0 transition-colors ${
                period === val ? "bg-white/[0.10] text-white" : "text-white/55 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4" style={{ height: 300 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center font-mono text-xs text-white/40">Lade…</div>
        ) : rows.length === 0 ? (
          <div className="h-full flex items-center justify-center font-mono text-xs text-white/40" data-testid="balance-empty">
            Noch keine Daten für diesen Zeitraum.
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} stroke="rgba(255,255,255,0.25)" />
              <YAxis tick={TICK} stroke="rgba(255,255,255,0.25)" unit=" kWh" width={70} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
