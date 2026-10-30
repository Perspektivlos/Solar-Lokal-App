/* Ansicht „Multilinie (Option 1)": synchroner Leistungsverlauf mit ausblendbaren Kurven. */
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";
import { formatNum } from "../solar-ui";
import { CH, CARD, TICK, GRID_STROKE, BUCKET_MIN, hhmm, tzLabel } from "./shared";

const SERIES = [CH.pv, CH.house, CH.battery, CH.grid];

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-[#0b0f17]/95 px-3 py-2 font-mono text-[11px] shadow-xl" data-testid="vp-tooltip">
      <div className="text-white/50 mb-1">{hhmm(label)}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/60 w-10">{p.dataKey}</span>
          <span className="text-white">{formatNum(p.value, 0)} W</span>
        </div>
      ))}
    </div>
  );
}

export function EmptyChart({ loading }) {
  return (
    <div className="h-full grid place-items-center font-mono text-sm text-white/45" data-testid="vp-chart-empty">
      {loading ? "Lade Verlauf…" : "Noch keine Snapshots im Zeitraum."}
    </div>
  );
}

function LegendTile({ ch, value, hidden, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={!hidden} data-testid={`vp-legend-${ch.key.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-[11px] transition-opacity ${hidden ? "opacity-35" : "opacity-100"}`}
      style={{ color: ch.color, borderColor: `${ch.color}55`, background: `${ch.color}14` }}>
      <span className="w-2 h-2 rounded-full" style={{ background: ch.color }} />
      {ch.label} {formatNum(value, 0)} W
    </button>
  );
}

export default function MultiLine({ data, range, live, loading }) {
  const [hidden, setHidden] = useState({});
  const s = live?.summary || {};
  const values = { PV: s.pv_power, Haus: s.house_power, Akku: s.battery_power, Netz: s.grid_power };
  const toggle = (k) => setHidden((h) => ({ ...h, [k]: !h[k] }));

  return (
    <div className={`${CARD} p-4 sm:p-6`} data-testid="vp-multiline">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase tracking-[0.04em] text-[13px] text-white">
            <TrendingUp size={15} className="text-cyan-300" /> Synchroner Leistungsverlauf • {range.toUpperCase()} Zeitfenster
          </div>
          <div className="text-[11px] text-white/45 mt-0.5">Klicke auf die Legenden-Kacheln, um einzelne Kurven ein- oder auszublenden</div>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="vp-legend">
          {SERIES.map((ch) => <LegendTile key={ch.key} ch={ch} value={values[ch.key]} hidden={hidden[ch.key]} onToggle={() => toggle(ch.key)} />)}
        </div>
      </div>

      <div className="h-[280px] sm:h-[320px] mt-4" data-testid="vp-multiline-chart">
        {data.length === 0 ? <EmptyChart loading={loading} /> : (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={hhmm} tick={TICK} stroke="rgba(255,255,255,0.12)" minTickGap={24} />
              <YAxis tick={TICK} stroke="rgba(255,255,255,0.12)" tickFormatter={(v) => `${v}W`} width={52} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.28)" strokeDasharray="3 4" />
              {SERIES.map((ch) => (
                <Line key={ch.key} type="monotone" dataKey={ch.key} stroke={ch.color} strokeWidth={2} dot={false} hide={!!hidden[ch.key]}
                  strokeDasharray={ch.key === "Akku" ? "3 3" : undefined} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono text-[10.5px] text-white/50">
        <span>Nulldurchgang (0W): Trennlinie für Laden/Entladen &amp; Bezug/Einspeisung</span>
        <span className="inline-flex items-center gap-1.5" data-testid="vp-sample-rate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Abtastrate: Alle {BUCKET_MIN[range]} Min • Zeitbasis {tzLabel()}
        </span>
      </div>
    </div>
  );
}
