/* Akku-Verlauf: Leistung (W) und Ladezustand (%) mit getrennten Y-Achsen. */
import { BatteryCharging } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { formatNum } from "../solar-ui";
import { ChartTooltip, EmptyChart } from "./MultiLine";
import { CH, CARD, TICK, GRID_STROKE, hhmm } from "./shared";

const SOC_COLOR = "#A3E635";

export default function BatteryHistory({ data, live, loading }) {
  const power = live?.summary?.battery_power;
  const soc = live?.trucki?.soc;
  return (
    <div className={`${CARD} p-4 sm:p-6`} data-testid="vp-battery-chart">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 font-bold uppercase tracking-[0.04em] text-[13px] text-white">
          <BatteryCharging size={15} className="text-cyan-300" /> Akku-Leistung &amp; Ladezustand
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[11px]">
          <span className="px-2.5 py-1 rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-200" data-testid="vp-battery-power-value">
            Leistung {formatNum(power, 0)} W
          </span>
          <span className="px-2.5 py-1 rounded-md border border-lime-400/30 bg-lime-400/10 text-lime-300" data-testid="vp-battery-soc-value">
            SoC {formatNum(soc, 0)}%
          </span>
        </div>
      </div>
      <div className="h-[210px] sm:h-[240px] mt-4" data-testid="vp-battery-history-plot">
        {data.length === 0 ? <EmptyChart loading={loading} /> : (
          <ResponsiveContainer minWidth={0} initialDimension={{ width: 1200, height: 240 }}>
            <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={hhmm} tick={TICK} stroke="rgba(255,255,255,0.12)" minTickGap={24} />
              <YAxis yAxisId="power" tick={TICK} stroke="rgba(255,255,255,0.12)" tickFormatter={(v) => `${v}W`} width={52} />
              <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={TICK} stroke="rgba(163,230,53,0.24)" tickFormatter={(v) => `${v}%`} width={38} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
              <ReferenceLine yAxisId="power" y={0} stroke="rgba(255,255,255,0.24)" strokeDasharray="3 4" />
              <Line yAxisId="power" type="monotone" dataKey="Akku" stroke={CH.battery.color} strokeWidth={2.4} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line yAxisId="soc" type="monotone" dataKey="SoC" stroke={SOC_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}