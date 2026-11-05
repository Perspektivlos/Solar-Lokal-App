import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSmartShuntHistory } from "../../lib/api";
import { fmt } from "./format";

const RANGES = ["1h", "3h", "6h", "12h", "24h"];
const TICK = { fontSize: 10, fontFamily: "JetBrains Mono", fill: "#64748b" };

const TooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded border border-white/15 bg-[#090d16] px-3 py-2 shadow-xl" data-testid="smartshunt-chart-tooltip">
    <div className="font-mono text-[10px] text-white/45">{new Date(label).toLocaleTimeString("de-DE")}</div>
    {payload.map((item) => <div key={item.dataKey} className="mt-1 font-mono text-[11px]" style={{ color: item.color }}>{item.name}: {fmt(item.value, item.dataKey === "power_w" ? 0 : 2)} {item.unit}</div>)}
  </div>;
};

const ChartPanel = ({ id, title, points, children }) => (
  <section className="glass p-4 sm:p-5" data-testid={`smartshunt-history-${id}`}>
    <div className="flex items-center gap-2 border-b border-white/[0.07] pb-3 text-xs font-bold uppercase tracking-[0.14em]"><Activity size={14} className="text-cyan-300" /> {title}</div>
    <div className="mt-4 h-[245px] sm:h-[290px]" data-testid={`smartshunt-history-${id}-plot`}>
      {!points.length ? <div className="h-full grid place-items-center font-mono text-xs text-white/40">Keine Verlaufsdaten.</div> : children}
    </div>
  </section>
);

export const HistoryPanel = ({ current }) => {
  const [range, setRange] = useState("6h");
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true); setError("");
    getSmartShuntHistory(range).then((value) => setPoints(value.points || [])).catch(() => { setPoints([]); setError("Verlauf konnte nicht geladen werden."); }).finally(() => setLoading(false));
  };
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const fetchRows = () => getSmartShuntHistory(range).then((value) => { if (active) setPoints(value.points || []); }).catch(() => { if (active) { setPoints([]); setError("Verlauf konnte nicht geladen werden."); } }).finally(() => { if (active) setLoading(false); });
    fetchRows();
    const timer = setInterval(fetchRows, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [range]);
  const time = (value) => new Date(value).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5" data-testid="smartshunt-history-panel">
      <section className="glass p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-testid="smartshunt-history-controls">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">SmartShunt-Messverlauf</div>
          <div className="mt-1 font-mono text-[10px] text-white/40" data-testid="smartshunt-history-source-note">Leistung/SoC als gespeicherte Messpunkte · Gerätezähler werden nicht nachgerechnet</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((item) => <button type="button" key={item} onClick={() => setRange(item)} aria-pressed={range === item} data-testid={`smartshunt-range-${item}`} className={`h-8 min-w-10 rounded border px-2 font-mono text-[10px] transition-colors ${range === item ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-black/20 text-white/45 hover:text-white"}`}>{item}</button>)}
          <button type="button" onClick={load} disabled={loading} title="Verlauf aktualisieren" aria-label="Verlauf aktualisieren" data-testid="smartshunt-history-refresh" className="btn-neo grid h-8 w-8 place-items-center disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </section>

      {error && <div role="alert" className="glass border-l-[3px] border-l-red-400 px-4 py-3 text-sm text-red-200" data-testid="smartshunt-history-error">{error}</div>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ChartPanel id="power-current" title="Leistung & Strom" points={points}>
          <ResponsiveContainer minWidth={0} initialDimension={{ width: 700, height: 290 }}>
            <LineChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={time} tick={TICK} minTickGap={30} stroke="rgba(255,255,255,0.12)" />
              <YAxis yAxisId="power" tick={TICK} tickFormatter={(v) => `${v}W`} width={52} stroke="rgba(6,182,212,0.3)" />
              <YAxis yAxisId="current" orientation="right" tick={TICK} tickFormatter={(v) => `${v}A`} width={45} stroke="rgba(245,158,11,0.3)" />
              <Tooltip content={<TooltipBox />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
              <ReferenceLine yAxisId="power" y={0} stroke="rgba(255,255,255,0.24)" strokeDasharray="3 4" />
              <Line yAxisId="power" name="Leistung" unit="W" type="monotone" dataKey="power_w" stroke="#06B6D4" strokeWidth={2.3} dot={false} isAnimationActive={false} />
              <Line yAxisId="current" name="Strom" unit="A" type="monotone" dataKey="current_a" stroke="#F59E0B" strokeWidth={1.7} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel id="voltage-soc" title="Spannung & Ladezustand" points={points}>
          <ResponsiveContainer minWidth={0} initialDimension={{ width: 700, height: 290 }}>
            <LineChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={time} tick={TICK} minTickGap={30} stroke="rgba(255,255,255,0.12)" />
              <YAxis yAxisId="voltage" domain={["dataMin - 0.3", "dataMax + 0.3"]} tick={TICK} tickFormatter={(v) => `${Number(v).toFixed(1)}V`} width={50} stroke="rgba(6,182,212,0.3)" />
              <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} tick={TICK} tickFormatter={(v) => `${v}%`} width={38} stroke="rgba(163,230,53,0.3)" />
              <Tooltip content={<TooltipBox />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
              <Line yAxisId="voltage" name="Spannung" unit="V" type="monotone" dataKey="voltage_v" stroke="#06B6D4" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              <Line yAxisId="soc" name="SoC" unit="%" type="monotone" dataKey="soc_pct" stroke="#A3E635" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="smartshunt-history-live-strip">
        {[ ["live-voltage", "Spannung", current.voltage_v, "V", 2], ["live-current", "Strom", current.current_a, "A", 2], ["live-power", "Leistung", current.power_w, "W", 0], ["live-soc", "SoC", current.soc_pct, "%", 1] ].map(([id, label, value, unit, digits]) => (
          <div key={id} className="border border-white/[0.08] bg-[#090d16] p-3 rounded">
            <div className="text-[9px] uppercase tracking-[0.15em] text-white/35">{label}</div>
            <div className="mt-1 font-mono text-lg text-white/85" data-testid={`smartshunt-history-${id}`}>{fmt(value, digits)} <span className="text-xs text-white/35">{unit}</span></div>
          </div>
        ))}
      </section>
    </div>
  );
};