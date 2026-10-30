/* Energie-Analyse: Verlauf, Akku/SoC, Tagesbilanz und Sonnen-Tagesverlauf. */
import { useEffect, useState } from "react";
import { getConfig, getHistory, getLive, getToday } from "../lib/api";
import IntroCard from "../components/IntroCard";
import SunTimeline from "../components/SunTimeline";
import TitleBar from "../components/verlauf/TitleBar";
import MultiLine from "../components/verlauf/MultiLine";
import FourChannels from "../components/verlauf/FourChannels";
import BatteryHistory from "../components/verlauf/BatteryHistory";
import DayBalance from "../components/verlauf/DayBalance";
import { RANGES, bucketize } from "../components/verlauf/shared";

const INTRO_SECTIONS = [
  { label: "Zweck & Funktion", body: "Analysiert PV-Erzeugung, Hauslast, Akku und Netz synchron. Akku-Leistung und SoC besitzen getrennte Skalen; die Tagesbilanz zeigt kWh-Werte und den Vergleich zu gestern." },
  { label: "Ansichten", body: "Multilinie bündelt alle Leistungswerte. Vier Kanäle trennt PV, Haus, Akku und Netz in eigene Diagramme. Die Auswahl bleibt auf diesem Gerät gespeichert." },
  { label: "Zeitbereiche", body: "1h · 3h · 6h · 12h · 24h. Die Abtastrate passt sich automatisch an und echte Datenlücken werden nicht überbrückt." },
  { label: "Tages-kWh", body: "Kennzahlen, Verteilungsbalken und gruppierte Tagesbalken zeigen Erzeugung, Eigenverbrauch, Speicherung, Netzbezug und Einspeisung." },
];

const stored = (key, valid, fallback) => {
  const value = localStorage.getItem(key);
  return valid(value) ? value : fallback;
};

export default function History() {
  const [view, setView] = useState(() => stored("vp-view", (v) => v === "multi" || v === "four", "multi"));
  const [range, setRange] = useState(() => stored("vp-range", (v) => RANGES.includes(v), "24h"));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(null);
  const [today, setToday] = useState(null);
  const [yesterday, setYesterday] = useState(null);
  const [grafanaUrl, setGrafanaUrl] = useState("");

  const pick = (setter, key) => (value) => {
    setter(value);
    localStorage.setItem(key, value);
  };

  useEffect(() => {
    let alive = true;
    getConfig().then((config) => { if (alive) setGrafanaUrl(config?.grafana_url || ""); }).catch(() => {});
    const load = () => {
      getLive().then((value) => { if (alive) setLive(value); }).catch(() => {});
      getToday().then((value) => { if (alive) setToday(value); }).catch(() => {});
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => getToday(1).then((value) => { if (alive) setYesterday(value); }).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = () => getHistory(range)
      .then((value) => { if (alive) setData(bucketize(value.points || [], range)); })
      .catch(() => { if (alive) setData([]); })
      .finally(() => { if (alive) setLoading(false); });
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [range]);

  return (
    <div className="space-y-6 page-reveal" data-testid="history-page">
      <IntroCard title="Verlauf" subtitle="Historische Leistung, Akku-SoC und Tagesenergien aus den lokalen Messdaten" sections={INTRO_SECTIONS} accent="#22D3EE" testid="intro-history" />
      <TitleBar view={view} onView={pick(setView, "vp-view")} range={range} onRange={pick(setRange, "vp-range")} grafanaUrl={grafanaUrl} />
      {view === "multi"
        ? <MultiLine data={data} range={range} live={live} loading={loading} />
        : <FourChannels data={data} live={live} loading={loading} />}
      {view === "multi" && <BatteryHistory data={data} live={live} loading={loading} />}
      <DayBalance live={live} today={today} yesterday={yesterday} />
      {live && <SunTimeline timestamp={live.timestamp} sun={live.sun} />}
    </div>
  );
}