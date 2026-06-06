import { useEffect, useState } from "react";
import { api } from "../lib/api";
import IntroCard from "../components/IntroCard";
import { Slider } from "../components/ui/slider";
import { toast } from "sonner";
import { Sun, Cloud, Thermometer, MapPin, RefreshCw } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";

const getForecast = () => api.get("/forecast").then((r) => r.data);
const getConfig = () => api.get("/config").then((r) => r.data);
const putConfig = (payload) => api.put("/config", payload).then((r) => r.data);

const TICK_STYLE = { fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#94a3b8" };
const TOOLTIP_STYLE = {
  borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)",
  fontFamily: "IBM Plex Mono", fontSize: 11,
  backgroundColor: "rgba(15,23,42,0.95)", color: "#f1f5f9",
};

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "PV-Erzeugungsprognose für die nächsten 48 Stunden basierend auf Open-Meteo Wetter-API (kostenlos, kein API-Key nötig). Hilft bei der Eigenverbrauchs-Planung — z.B. wann der Spülmaschinen-Start lohnt.",
  },
  {
    label: "Datenquelle",
    body: <span>Open-Meteo liefert stündlich Wolken-Bedeckung, Globalstrahlung (GHI), Direkt-Strahlung und Temperatur. PV-Leistung wird simuliert mit Formel: <code className="text-cyan-300">P = GHI × kWp × PR × Temp-Faktor</code> (PR = 0.80, Temp-Derating: −0.4&nbsp;%/K über 25 °C Modul-Temperatur).</span>,
  },
  {
    label: "Parameter",
    body: <span><b>Lat/Lon</b>: Standort der Anlage in WGS84 · <b>Peak kWp</b>: installierte Spitzenleistung. Diese Werte werden gespeichert und beim nächsten Aufruf wiederverwendet.</span>,
  },
  {
    label: "Cache & Aktualisierung",
    body: <span>Backend cached den Open-Meteo-Response für <b>15 Minuten</b>, um die Public-API nicht zu belasten. Hard-Reload-Button erzwingt einen frischen Abruf.</span>,
  },
  {
    label: "Einschränkungen",
    body: "Modell-Annahmen sind grob (kein Verschattungsmodell, keine Modul-Ausrichtungs-Korrektur, kein Schnee/Verschmutzungs-Faktor). Realität kann ±20-30 % abweichen. Für genauere Prognosen wäre PVlib oder Solcast empfehlenswert.",
  },
  {
    label: "Mögliche Fehler",
    body: <span>HTTP 502: Open-Meteo unreachable (Internet-Verbindung prüfen). Leere Werte: Latitude/Longitude außerhalb gültigen Bereichs oder kein Internet.</span>,
  },
];

function StatBox({ label, value, unit, accent }) {
  return (
    <div className="glass p-4" style={{ borderLeft: `3px solid ${accent}`, boxShadow: `0 0 24px -16px ${accent}aa` }}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">{label}</div>
      <div className="font-mono text-3xl font-medium mt-1" style={{ color: accent, textShadow: `0 0 8px ${accent}88` }}>
        {value}
        <span className="text-xs ml-1 text-white/45">{unit}</span>
      </div>
    </div>
  );
}

export default function Forecast() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); getForecast().then(setData).finally(() => setLoading(false)); };

  useEffect(() => {
    let alive = true;
    const init = async () => {
      try {
        const d = await getForecast();
        if (alive) setData(d);
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoading(false);
      }
      try {
        const c = await getConfig();
        if (alive) setCfg(c.forecast);
      } catch {
        /* ignore */
      }
    };
    init();
    return () => { alive = false; };
  }, []);

  const updCfg = (patch) => setCfg({ ...cfg, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      const r = await putConfig({ forecast: cfg });
      setCfg(r.forecast);
      toast.success("Standort gespeichert, neu lade Forecast");
      load();
    } catch (e) {
      toast.error("Speichern fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const chartData = (data?.hourly || []).map((h) => ({
    time: new Date(h.time).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }),
    hour: new Date(h.time).getHours(),
    "PV (W)": h.pv_w,
    "GHI (W/m²)": h.ghi,
    "Cloud (%)": h.cloud,
    "Temp (°C)": h.temp,
  }));

  const midnightIdx = chartData.findIndex((d) => d.hour === 0);

  return (
    <div className="space-y-6" data-testid="forecast-page">
      <IntroCard title="Forecast" subtitle="PV-Erzeugungsprognose für die nächsten 48 h (Open-Meteo)" sections={INTRO_SECTIONS} accent="#FACC15" testid="intro-forecast" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
          <span className="w-1.5 h-7 rounded-sm" style={{ background: "#FACC15", boxShadow: "0 0 10px #FACC1588" }} />
          PV-Forecast
        </h1>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50 inline-flex items-center"
          style={{ background: "linear-gradient(180deg, #fde047, #FACC15)", boxShadow: "0 0 12px rgba(250,204,21,0.4)" }}
          data-testid="btn-reload-forecast">
          <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} /> Neu laden
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox label="Heute (Rest)" value={data?.summary?.kwh_today_forecast?.toFixed(2) ?? "–"} unit="kWh" accent="#FACC15" />
        <StatBox label="Morgen" value={data?.summary?.kwh_tomorrow_forecast?.toFixed(2) ?? "–"} unit="kWh" accent="#10B981" />
        <StatBox label="Peak kWp" value={data?.location?.peak_kwp?.toFixed(1) ?? "–"} unit="kWp" accent="#06B6D4" />
      </div>

      {/* Forecast Chart */}
      <div className="glass">
        <div className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/65 flex items-center justify-between">
          <span>PV-Leistung · nächste 48 h</span>
          <span className="text-white/40">
            {data?.fetched_at ? `Abgerufen: ${new Date(data.fetched_at).toLocaleTimeString("de-DE")}` : ""}
          </span>
        </div>
        <div className="p-4" style={{ height: 380 }}>
          {chartData.length > 0 && (
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FACC15" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#FACC15" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" interval={5} />
                <YAxis tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" label={{ value: "W", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="PV (W)" stroke="#FACC15" strokeWidth={2.5} fill="url(#pvGrad)"
                      style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.55))" }} />
                {midnightIdx > 0 && (
                  <ReferenceLine x={chartData[midnightIdx].time} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" label={{ value: "Tageswechsel", fontSize: 9, fill: "#64748b", position: "top" }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cloud + Temp Chart */}
      <div className="glass">
        <div className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">
          Wetter · Bewölkung & Temperatur
        </div>
        <div className="p-4" style={{ height: 240 }}>
          {chartData.length > 0 && (
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" interval={5} />
                <YAxis yAxisId="left" tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" domain={[0, 100]} label={{ value: "%", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
                <YAxis yAxisId="right" orientation="right" tick={TICK_STYLE} stroke="rgba(255,255,255,0.25)" label={{ value: "°C", angle: 90, position: "insideRight", fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area yAxisId="left" type="monotone" dataKey="Cloud (%)" stroke="#cbd5e1" strokeWidth={2} fill="url(#cloudGrad)" />
                <Area yAxisId="right" type="monotone" dataKey="Temp (°C)" stroke="#F87171" strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Location config */}
      <div className="glass" style={{ borderLeft: "3px solid #06B6D4" }}>
        <div className="border-b border-white/10 px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65 flex items-center gap-2">
            <MapPin size={12} /> Standort & Anlagen-Daten
          </div>
          <button onClick={save} disabled={saving || !cfg}
            className="px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, #67e8f9, #06B6D4)", boxShadow: "0 0 10px rgba(6,182,212,0.4)" }}
            data-testid="btn-save-forecast">
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
        {cfg && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Latitude</label>
              <input type="number" step="0.01" value={cfg.latitude} onChange={(e) => updCfg({ latitude: Number(e.target.value) })}
                     className="glass-input w-full px-3 py-2 font-mono text-sm mt-1" data-testid="input-lat" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Longitude</label>
              <input type="number" step="0.01" value={cfg.longitude} onChange={(e) => updCfg({ longitude: Number(e.target.value) })}
                     className="glass-input w-full px-3 py-2 font-mono text-sm mt-1" data-testid="input-lon" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Peak kWp</label>
              <div className="flex items-center gap-3 mt-3">
                <Slider value={[cfg.peak_kwp]} onValueChange={(v) => updCfg({ peak_kwp: v[0] })} min={0.1} max={20} step={0.1} className="flex-1" />
                <span className="font-mono text-base text-yellow-300 font-semibold w-16 text-right">
                  {cfg.peak_kwp.toFixed(1)} <span className="text-xs text-white/45">kWp</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
