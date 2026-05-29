import { useEffect, useState } from "react";
import { getHistory } from "../lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

const RANGES = ["1h", "6h", "12h", "24h"];

// Chart styling constants — extracted to module scope so they keep stable
// references across renders (avoids unnecessary Recharts re-renders).
const TICK_STYLE = { fontSize: 10, fontFamily: "IBM Plex Mono" };
const Y_LABEL_W = { value: "W", angle: -90, position: "insideLeft", fontSize: 10 };
const Y_LABEL_PCT = { value: "%", angle: -90, position: "insideLeft", fontSize: 10 };
const Y_DOMAIN_SOC = [0, 100];
const TOOLTIP_STYLE = { borderRadius: 0, border: "1px solid #000", fontFamily: "IBM Plex Mono", fontSize: 11 };
const LEGEND_STYLE = { fontFamily: "IBM Plex Sans", fontSize: 11 };

function ChartBody({ loading, data }) {
  if (loading) return <div className="font-mono text-sm text-gray-600">Lade Verlauf...</div>;
  if (data.length === 0) {
    return (
      <div className="font-mono text-sm text-gray-600" data-testid="history-empty">
        Noch keine Snapshots im Zeitraum.
      </div>
    );
  }
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" />
        <XAxis dataKey="ts" tick={TICK_STYLE} stroke="#000" />
        <YAxis tick={TICK_STYLE} stroke="#000" label={Y_LABEL_W} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Line type="monotone" dataKey="PV" stroke="#EAB308" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Netz" stroke="#EF4444" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Akku" stroke="#3B82F6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Haus" stroke="#000000" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function History() {
  const [range, setRange] = useState("1h");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getHistory(range)
      .then((d) => {
        if (!alive) return;
        const pts = (d.points || []).map((p) => ({
          ts: new Date(p.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
          PV: p.pv_power,
          Netz: p.grid_power,
          Akku: p.battery_power,
          Haus: p.house_power,
          SoC: p.battery_soc,
        }));
        setData(pts);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range]);

  return (
    <div className="space-y-6" data-testid="history-page">
      <div className="flex items-center justify-between border-b border-black pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Verlauf</h1>
        <div className="flex border border-black" data-testid="range-toggle">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              data-testid={`range-${r}`}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] border-l border-black first:border-l-0 ${
                range === r ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-black bg-white">
        <div className="border-b border-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">
          Leistung · {range}
        </div>
        <div className="p-4" style={{ height: 360 }}>
          <ChartBody loading={loading} data={data} />
        </div>
      </div>

      <div className="border border-black bg-white">
        <div className="border-b border-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">
          Akku SoC · {range}
        </div>
        <div className="p-4" style={{ height: 220 }}>
          {data.length > 0 && (
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" />
                <XAxis dataKey="ts" tick={TICK_STYLE} stroke="#000" />
                <YAxis domain={Y_DOMAIN_SOC} tick={TICK_STYLE} stroke="#000" label={Y_LABEL_PCT} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="SoC" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
