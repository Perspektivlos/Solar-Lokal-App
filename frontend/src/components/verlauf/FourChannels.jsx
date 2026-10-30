/* Ansicht „4 Kanäle (Option 2)": vier Einzeldiagramme mit eigener Skala. */
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { Sun, Zap, BatteryCharging, Activity } from "lucide-react";
import { formatNum } from "../solar-ui";
import { CH, CARD, TICK, GRID_STROKE, hhmm } from "./shared";
import { ChartTooltip, EmptyChart } from "./MultiLine";

function Channel({ ch, icon: Icon, title, value, data, area, zero, testid, loading }) {
  const gid = `vp-grad-${ch.key}`;
  const axes = (
    <>
      <CartesianGrid stroke={GRID_STROKE} vertical={false} />
      <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={hhmm} tick={TICK} stroke="rgba(255,255,255,0.12)" minTickGap={20} />
      <YAxis tick={TICK} stroke="rgba(255,255,255,0.12)" width={40} />
      <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
      {zero && <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" />}
    </>
  );
  return (
    <div className={`${CARD} p-4`} data-testid={testid}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold min-w-0" style={{ color: ch.color }}>
          <Icon size={14} className="shrink-0" /> <span className="truncate">{title}</span>
        </div>
        <div className="font-mono text-[13px] font-bold text-white whitespace-nowrap" data-testid={`${testid}-value`}>{value}</div>
      </div>
      <div className="h-[130px]">
        {data.length === 0 ? <EmptyChart loading={loading} /> : (
          <ResponsiveContainer>
            {area ? (
              <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ch.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ch.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                {axes}
                <Area type="monotone" dataKey={ch.key} stroke={ch.color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                {axes}
                <Line type="monotone" dataKey={ch.key} stroke={ch.color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function FourChannels({ data, live, loading }) {
  const s = live?.summary || {};
  const soc = live?.trucki?.soc;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="vp-four">
      <Channel ch={CH.pv} icon={Sun} title="PV-Erzeugung (Hoymiles + Victron)" value={`${formatNum(s.pv_power, 0)} W`} data={data} area testid="vp-ch-pv" loading={loading} />
      <Channel ch={CH.house} icon={Zap} title="Hausverbrauch (Gesamtlast)" value={`${formatNum(s.house_power, 0)} W`} data={data} area testid="vp-ch-house" loading={loading} />
      <Channel ch={CH.battery} icon={BatteryCharging} title="Akku-Nutzung & LiFePO4 SoC" value={`${formatNum(s.battery_power, 0)} W (${formatNum(soc, 0)}%)`} data={data} zero testid="vp-ch-battery" loading={loading} />
      <Channel ch={CH.grid} icon={Activity} title="Netzbezug / Netzeinspeisung (Shelly Pro 3EM)" value={`${formatNum(s.grid_power, 0)} W`} data={data} zero testid="vp-ch-grid" loading={loading} />
    </div>
  );
}
