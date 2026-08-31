import { useEffect, useState } from "react";
import { getHistory } from "../lib/api";
import IntroCard from "../components/IntroCard";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

const RANGES = ["1h", "6h", "12h", "24h"];

const TICK_STYLE = { fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" };
const Y_LABEL_W = { value: "W", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" };
const Y_LABEL_PCT = { value: "%", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" };
const Y_DOMAIN_SOC = [0, 100];
const TOOLTIP_STYLE = {
  borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)",
  fontFamily: "JetBrains Mono", fontSize: 11,
  backgroundColor: "rgba(15,23,42,0.95)", color: "#f1f5f9",
};
const TOOLTIP_LABEL_STYLE = { color: "#cbd5e1" };
const LEGEND_STYLE = { fontFamily: "Chakra Petch", fontSize: 11, color: "#cbd5e1" };

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Zeigt den historischen Verlauf der Leistungs- und Akku-Werte aus den 15-Sekunden-Snapshots, die das Backend in MongoDB speichert. Vier Leistungs-Linien (PV / Netz / Akku / Haus) + separater SoC-Verlauf.",
  },
  {
    label: "Zeitbereiche",
    body: "1h · 6h · 12h · 24h — wählbar oben rechts. Endpoint /api/history?range=… filtert Snapshots ab now-range.",
  },
  {
    label: "Datenpunkte",
    body: "Mehr als 600 Punkte werden automatisch geglättet (gleichmäßiges Sampling im Backend). Für 24h bei 15-s-Snapshots wären das 5760 Punkte → auf ~580 reduziert.",
  },
  {
    label: "Skala / Farben",
    body: <span>Y-Achse: Watt (oben) bzw. Prozent SoC (unten). Farben: Gelb&nbsp;= PV, Rot&nbsp;= Netz (positiv = Bezug), Cyan&nbsp;= Akku, Hell&nbsp;= Hausverbrauch.</span>,
  },
  {
    label: "Einschränkungen",
    body: "Snapshots werden nur geschrieben wenn der Backend-Service läuft. Während Backend-Restarts entstehen kurze Lücken in der Kurve. Es findet keine Lücken-Interpolation statt — Recharts verbindet die nächsten gültigen Punkte.",
  },
  {
    label: "Mögliche Fehler",
    body: "‚Noch keine Snapshots im Zeitraum‘ → Backend wurde gerade erst gestartet oder DB ist leer. Lösung: warten oder /api/diagnostics/run prüfen.",
  },
];

function ChartBody({ loading, error, data }) {
  if (loading) return <div className="font-mono text-sm text-white/55">Lade Verlauf...</div>;
  if (error) {
    return <div role="alert" className="font-mono text-sm text-red-300" data-testid="history-error">Verlaufsdaten konnten nicht geladen werden.</div>;
  }
  if (data.length === 0) {
    return <div className="font-mono text-sm text-white/55" data-testid="history-empty">Noch keine Snapshots im Zeitraum.</div>;
  }
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.09)" />
        <XAxis dataKey="ts" tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" />
        <YAxis tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" label={Y_LABEL_W} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Line type="monotone" dataKey="PV" stroke="#FACC15" strokeWidth={3} dot={false}
              style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.7))" }} />
        <Line type="monotone" dataKey="Netz" stroke="#F87171" strokeWidth={3} dot={false}
              style={{ filter: "drop-shadow(0 0 6px rgba(248,113,113,0.7))" }} />
        <Line type="monotone" dataKey="Akku" stroke="#06B6D4" strokeWidth={3} dot={false}
              style={{ filter: "drop-shadow(0 0 6px rgba(6,182,212,0.7))" }} />
        <Line type="monotone" dataKey="Haus" stroke="#cbd5e1" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function History() {
  const [range, setRange] = useState("1h");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await getHistory(range);
        if (!alive) return;
        const pts = (d.points || []).map((p) => ({
          ts: new Date(p.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
          PV: p.pv_power, Netz: p.grid_power, Akku: p.battery_power, Haus: p.house_power, SoC: p.battery_soc,
        }));
        setError(false);
        setData(pts);
      } catch {
        if (alive) { setError(true); setData([]); }
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [range]);

  return (
    <div className="space-y-6" data-testid="history-page">
      <IntroCard title="Verlauf" subtitle="Historische Leistungs- und SoC-Kurven aus MongoDB-Snapshots" sections={INTRO_SECTIONS} accent="#06B6D4" testid="intro-history" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
          <span className="w-1.5 h-7 rounded-sm" style={{ background: "#06B6D4", boxShadow: "0 0 10px #06B6D488" }} />
          Verlauf
        </h1>
        <div className="flex glass overflow-hidden" data-testid="range-toggle">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              data-testid={`range-${r}`}
              aria-pressed={range === r}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] border-l border-white/10 first:border-l-0 transition-colors ${
                range === r ? "bg-white/[0.10] text-white" : "text-white/55 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="glass">
        <div className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">
          Leistung · {range}
        </div>
        <div className="p-4" style={{ height: 380 }}>
          <ChartBody loading={loading} error={error} data={data} />
        </div>
      </div>

      <div className="glass">
        <div className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">
          Akku SoC · {range}
        </div>
        <div className="p-4" style={{ height: 220 }}>
          {data.length > 0 && (
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="ts" tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" />
                <YAxis domain={Y_DOMAIN_SOC} tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" label={Y_LABEL_PCT} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Line type="monotone" dataKey="SoC" stroke="#06B6D4" strokeWidth={2.5} dot={false}
                      style={{ filter: "drop-shadow(0 0 5px rgba(6,182,212,0.6))" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
