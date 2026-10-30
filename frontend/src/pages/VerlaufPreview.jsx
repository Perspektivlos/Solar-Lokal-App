/* Vorschau der neuen Verlauf-Seite (/verlauf-preview): Energie-Analyse, Tagesbilanz, Sonnen-Tagesverlauf. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getHistory, getLive, getToday } from "../lib/api";
import SunTimeline from "../components/SunTimeline";
import TitleBar from "../components/verlauf/TitleBar";
import MultiLine from "../components/verlauf/MultiLine";
import FourChannels from "../components/verlauf/FourChannels";
import DayBalance from "../components/verlauf/DayBalance";
import { RANGES, bucketize } from "../components/verlauf/shared";

const stored = (k, ok, d) => { const v = localStorage.getItem(k); return ok(v) ? v : d; };

export default function VerlaufPreview() {
  const [view, setView] = useState(() => stored("vp-view", (v) => v === "multi" || v === "four", "multi"));
  const [range, setRange] = useState(() => stored("vp-range", (v) => RANGES.includes(v), "24h"));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(null);
  const [today, setToday] = useState(null);

  const pick = (setter, key) => (v) => { setter(v); localStorage.setItem(key, v); };

  useEffect(() => {
    const load = () => {
      getLive().then(setLive).catch(() => {});
      getToday().then(setToday).catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = () => getHistory(range)
      .then((d) => { if (alive) setData(bucketize(d.points || [], range)); })
      .catch(() => { if (alive) setData([]); })
      .finally(() => { if (alive) setLoading(false); });
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [range]);

  return (
    <div className="space-y-6 page-reveal" data-testid="verlauf-preview-page">
      <Link to="/verlauf" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200 transition-colors" data-testid="vp-back">
        <ArrowLeft size={13} /> Aktuelle Verlauf-Ansicht · Vorschau
      </Link>
      <TitleBar view={view} onView={pick(setView, "vp-view")} range={range} onRange={pick(setRange, "vp-range")} />
      {view === "multi"
        ? <MultiLine data={data} range={range} live={live} loading={loading} />
        : <FourChannels data={data} live={live} loading={loading} />}
      <DayBalance live={live} today={today} />
      {live && <SunTimeline timestamp={live.timestamp} sun={live.sun} />}
    </div>
  );
}
