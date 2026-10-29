import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowUp, Plus, Replace, Ban, CheckCircle2, Clock, CalendarClock,
  Workflow, Lightbulb, Cpu, LayoutGrid, Activity, Sun, BatteryCharging, Home,
  Plug, Gauge, Database, Radio, LineChart, ShieldCheck, Server, ArrowRight,
} from "lucide-react";
import { COLOR } from "../components/solar-ui";
import { MiniMock } from "../components/MiniMock";
import { APP_NAME, APP_VERSION, APP_LAST_UPDATED, ROADMAP } from "../lib/appmeta";

/* Reiner Lese-Bericht „Was wir erreicht haben" – eigene Vorschau-Adresse (/report-preview),
 * nicht im Menü. Fest kuratierter Inhalt, Stand v1.5.0. SCADA-Dark-Look wie die übrige App. */

const SECTIONS = [
  { id: "kopf", label: "Überblick" },
  { id: "changelog", label: "Changelog" },
  { id: "zeitachse", label: "Zeitachse" },
  { id: "arbeitsweise", label: "Arbeitsweise" },
  { id: "erkenntnisse", label: "Erkenntnisse" },
  { id: "technik", label: "Technik" },
];

const ADDED = [
  { icon: Activity, title: "Live-Dashboard mit animiertem Energiefluss", desc: "Herzstück: Echtzeit-Übersicht aller Leistungsflüsse mit Plasma-Animation zwischen Erzeugern, Speicher, Haus und Netz." },
  { icon: LayoutGrid, title: "Vier große Geräte-Karten", desc: "Solar PV, Batterie 48 V, Hausverbrauch und Stromnetz – je mit LCD-Wert, Tagesenergie und Statusbadge." },
  { icon: Sun, title: "Sonnen-Tagesverlauf (Balken & Bogen)", desc: "Aufgang bis Untergang mit Dämmerungsphasen, Jetzt-Marker und umschaltbarer Ansicht." },
  { icon: Gauge, title: "Favoriten anpinnen (inkl. MPPT-Strings & Phasen)", desc: "Wichtigste Werte als KPI-Leiste ganz oben, per Drag-&-Drop sortierbar, serverseitig gespeichert." },
  { icon: Plug, title: "Steuerung: Hoymiles-Limit & Trucki/SUN", desc: "Wirkleistungsgrenze und Entlade-Regler direkt aus der App bedienbar." },
  { icon: ShieldCheck, title: "Diagnose & Geräte-Selbsttest", desc: "Geräte-Erkennung, Firmware-Vergleich und geführter Selbsttest zur Fehlersuche." },
  { icon: Database, title: "Grafana & InfluxDB angebunden", desc: "Auto-Provisioning mit fester Datenquelle und einem 43-Panel-Dashboard im SCADA-Look." },
  { icon: CalendarClock, title: "Versions-Fußleiste, Doku & Anleitung", desc: "Fixe Leiste mit Version, Modus und Stand; eigene Doku-Seite mit Roadmap und Anlagen-Anleitung." },
  { icon: Workflow, title: "Editierbare Roadmap & „Was ist neu?\"", desc: "Roadmap dauerhaft in der App bearbeiten (Drag-&-Drop); Hinweis-Fenster bei neuen erledigten Punkten." },
  { icon: LineChart, title: "Konfigurierbare Akkukapazität & Beschriftungen", desc: "Nutzbare kWh und Gerätetexte in den Einstellungen anpassbar – fließt in Karten und Kennzahlen ein." },
];

const REPLACED = [
  { before: "Sechs kleine LCD-Kacheln", after: "Vier große Geräte-Karten", why: "Bessere Lesbarkeit und mehr Kontext (Tageswerte, Status) pro Gerät." },
  { before: "Aggregierter „PV-Block\"", after: "Einzelne Geräte-Knoten im Energiefluss", why: "Zeigt MPPT 1/2, Hoymiles, Speicher, Netz und Haus getrennt – echte DC/AC-Topologie." },
  { before: "Footer-Roadmap-Dialog (Popup)", after: "Fixe Versions-Fußleiste + eigene Doku-Seite", why: "Dauerhaft sichtbarer Status und ausführliche Doku statt kleinem Overlay." },
  { before: "Statische Roadmap (fest im Code)", after: "Dauerhaft editierbare Roadmap", why: "Punkte lassen sich in der App pflegen und werden installationsweit gespeichert." },
  { before: "Seitlich scrollbares Flussdiagramm (Handy)", after: "Echtes Hochformat-Layout", why: "Auf dem Handy von oben nach unten lesbar, ohne horizontales Scrollen." },
];

const REMOVED = [
  { title: "48-Stunden-PV-Prognose", why: "Bewusst nicht umgesetzt – Fokus bleibt auf Echtzeit-Betrieb und Diagnose statt Wettervorhersage." },
  { title: "Watt-Beschriftungen auf den Energiefluss-Linien", why: "Zugunsten einer ruhigen, übersichtlichen Darstellung entfernt; Werte stehen in den Knoten/Karten." },
  { title: "CSV-Datenexport", why: "Nicht gewünscht – Auswertung erfolgt über Grafana/InfluxDB." },
];

const TIMELINE = [
  { date: "06/2026", title: "Grundlagen & SCADA-Design", desc: "Live-Dashboard, Energiefluss, DSEG7-LCD-Look, Steuerung, Alarme, Diagnose, MQTT & InfluxDB, lokaler Start.", before: { v: "blank", label: "Leerer Start" }, after: { v: "dashboard", label: "Live-Dashboard" } },
  { date: "10/2026", title: "Grafana-Ausbau & Fixes", desc: "42/43-Panel-Dashboard, feste Datenquellen-UID, SCADAvis-Synoptik-Vorschau und -Panel.", before: { v: "grafana-error", label: "Quelle fehlt" }, after: { v: "grafana-grid", label: "43 Panels" } },
  { date: "07.10.2026", title: "Favoriten & Tagesverlauf", desc: "Favoriten (Geräte, MPPT-Strings, Phasen) per Drag-&-Drop; Sonnen-Tagesverlauf Balken/Bogen.", before: { v: "dash-nofav", label: "Ohne Favoriten" }, after: { v: "dash-fav", label: "Favoriten + Sonne" } },
  { date: "29.10.2026", title: "Dashboard-Redesign", desc: "Vier Geräte-Karten, Energiefluss Kompakt/Detail/Auto, Fluss-/Tempo-Regler, Kennzahlen-Zeile, Mobil-Hochformat.", before: { v: "six-tiles", label: "6 LCD-Kacheln" }, after: { v: "four-cards", label: "4 Geräte-Karten" } },
  { date: "29.10.2026", title: "Einstellungen & Doku (v1.4.0)", desc: "Konfigurierbare Kapazität & Beschriftungen, Versions-Fußleiste, Doku-Seite mit Roadmap & Anleitung.", before: { v: "popup", label: "Popup-Dialog" }, after: { v: "footer-docs", label: "Fußleiste + Doku" } },
  { date: "29.10.2026", title: "Editierbare Roadmap (v1.5.0)", desc: "Roadmap in der App bearbeiten & speichern, „Was ist neu?\"-Fenster beim Versionssprung.", before: { v: "roadmap-static", label: "Statisch" }, after: { v: "roadmap-edit", label: "Editierbar" } },
];

const WORKFLOW = [
  { title: "Erst fragen, dann bauen", desc: "Vor jeder größeren Aufgabe Rückfragen und ausdrückliche Freigabe des Plans – keine ungefragten neuen Funktionen." },
  { title: "Umsetzen in klaren Phasen", desc: "Zuerst die schwierigen Teile zum Laufen bringen, dann zu einem stimmigen Ganzen zusammenfügen." },
  { title: "Prüfen vor Abnahme", desc: "Jede Funktion wird geprüft – per eigenem Test (Abfragen/Screenshots) oder vollem Testdurchlauf – bevor sie als fertig gilt." },
  { title: "Demo-Modus als Standard", desc: "Standardmäßig läuft alles im Demo-Modus, damit keine echte Hardware ungewollt angesprochen wird." },
  { title: "Durchgehend Deutsch & SCADA-Look", desc: "Sprache und Erscheinungsbild bleiben über die ganze App konsistent." },
];

const LEARNINGS = [
  { title: "Grafana fand die Datenquelle nicht", desc: "Das Dashboard verwies auf eine feste Kennung, die Provisioning-Datei hatte keine – Lösung: beiden Dateien dieselbe feste Kennung „influxdb-solar\" gegeben." },
  { title: "Firmware war ein Objekt statt Text", desc: "Die Firmware-Angabe kam als Objekt (Status/aktuell/neueste) – die Anzeige liest jetzt gezielt die aktuelle Version aus." },
  { title: "Energiefluss auf dem Handy", desc: "Statt seitlich scrollbarem Diagramm ein echtes Hochformat mit gestapelten Spalten – ohne horizontales Scrollen." },
  { title: "Deutsche Zahlenformate", desc: "Werte durchgängig mit Komma als Dezimaltrennzeichen (de-DE) statt Punkt." },
  { title: "Keine erfundenen Werte", desc: "Nur real vorhandene Messwerte zeigen; fehlende Angaben werden weggelassen statt geschätzt." },
];

const DEVICES = [
  { icon: Gauge, title: "Shelly Pro 3EM", sub: "3-Phasen-Energiezähler (Netz)" },
  { icon: Sun, title: "Hoymiles HM-1500", sub: "AhoyDTU · AC-Wechselrichter" },
  { icon: BatteryCharging, title: "Trucki2Shelly / SUN-2000", sub: "Entlade-Regler / Gateway" },
  { icon: Sun, title: "2× Victron SmartSolar MPPT", sub: "VenusOS Large (DC)" },
  { icon: BatteryCharging, title: "LiFePO4-Speicher", sub: "48-V-Hausbatterie" },
];

const BUILDING_BLOCKS = [
  { icon: Radio, title: "Mosquitto MQTT-Broker", sub: "Nachrichten-Drehscheibe der Geräte" },
  { icon: Database, title: "InfluxDB (Zeitreihen)", sub: "Langzeit-Messwertspeicher" },
  { icon: LineChart, title: "Grafana", sub: "43-Panel-Analyse-Dashboard" },
  { icon: Server, title: "Lokaler Betrieb", sub: "Läuft vollständig im Heimnetz" },
];

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const els = ref.current?.querySelectorAll("[data-reveal]");
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("reveal-in")),
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

const SectionTitle = ({ icon: Icon, color, kicker, title }) => (
  <div className="mb-6" data-reveal>
    <div className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color }}>{kicker}</div>
    <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-1.5 flex items-center gap-3">
      <span className="grid place-items-center w-9 h-9 rounded-lg border" style={{ borderColor: `${color}44`, background: `${color}14`, color }}>
        <Icon size={18} />
      </span>
      {title}
    </h2>
  </div>
);

export default function Report() {
  const containerRef = useReveal();
  const [showTop, setShowTop] = useState(false);
  const [active, setActive] = useState("kopf");

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 480);
      let cur = "kopf";
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 120) cur = s.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jump = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const counts = {
    done: ROADMAP.filter((r) => r.status === "done").length,
    wip: ROADMAP.filter((r) => r.status === "wip").length,
    planned: ROADMAP.filter((r) => r.status === "planned").length,
  };
  const kpis = [
    { label: "Funktionen erledigt", value: counts.done, color: COLOR.grid_exp },
    { label: "In Arbeit", value: counts.wip, color: COLOR.battery },
    { label: "Geplant", value: counts.planned, color: "#8C92AC" },
    { label: "Gerätetypen angebunden", value: DEVICES.length, color: COLOR.pv },
    { label: "Ausbaustufen", value: TIMELINE.length, color: COLOR.victron },
  ];

  return (
    <div ref={containerRef} className="min-h-screen text-white" data-testid="report-page">
      {/* Sticky Sprungmarken-Leiste */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#04060c]/80 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center gap-3 sm:gap-5 overflow-x-auto no-scrollbar">
          <Link to="/" data-testid="report-back" className="shrink-0 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300 hover:text-cyan-200 transition-colors">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="shrink-0 w-px h-5 bg-white/12" />
          <nav className="flex items-center gap-1.5 sm:gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`report-nav-${s.id}`}
                onClick={() => jump(s.id)}
                className={`shrink-0 px-3 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] border transition-colors ${
                  active === s.id ? "bg-cyan-400/15 text-cyan-200 border-cyan-400/40" : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 pb-28">
        {/* 1 · Kopf / Überblick */}
        <section id="kopf" className="scroll-mt-20 pt-12 sm:pt-16">
          <div data-reveal>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">Projektbericht</div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mt-3 leading-[1.05]">
              Was wir erreicht haben
            </h1>
            <p className="text-white/60 text-base sm:text-lg mt-4 max-w-2xl leading-relaxed">
              {APP_NAME} – ein lokales SCADA-Dashboard für die eigene Solaranlage: visualisieren, steuern,
              analysieren und diagnostizieren. Dieser Bericht erzählt den gesamten Projektverlauf.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 mt-5 font-mono text-[12px]">
              <span className="px-3 py-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">Version {APP_VERSION}</span>
              <span className="px-3 py-1.5 rounded-md border border-white/12 text-white/55">Stand {APP_LAST_UPDATED}</span>
              <span className="px-3 py-1.5 rounded-md border border-amber-400/25 bg-amber-400/5 text-amber-200/90">Demo-Modus Standard</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-10" data-reveal>
            {kpis.map((k) => (
              <div key={k.label} data-testid={`report-kpi-${k.label}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="font-dseg text-3xl neon-text-cyan" style={{ color: k.color, textShadow: `0 0 10px ${k.color}66` }}>{k.value}</div>
                <div className="text-white/50 text-[12px] mt-1.5 leading-snug">{k.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-white/10 my-14" />

        {/* 2 · Changelog */}
        <section id="changelog" className="scroll-mt-20">
          <SectionTitle icon={Replace} color={COLOR.battery} kicker="Funktions-Changelog" title="Hinzugefügt · Abgelöst · Entfernt" />

          {/* Hinzugefügt */}
          <div className="mb-10" data-reveal>
            <div className="flex items-center gap-2 mb-4 text-[#10B981]">
              <Plus size={16} /><h3 className="font-mono text-[12px] uppercase tracking-[0.16em]">Hinzugefügt</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {ADDED.map((f) => (
                <div key={f.title} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 flex gap-3">
                  <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-emerald-500/10 text-emerald-300"><f.icon size={17} /></span>
                  <div>
                    <div className="text-white font-medium text-sm">{f.title}</div>
                    <div className="text-white/50 text-[13px] mt-1 leading-relaxed">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Abgelöst */}
          <div className="mb-10" data-reveal>
            <div className="flex items-center gap-2 mb-4 text-amber-300">
              <Replace size={16} /><h3 className="font-mono text-[12px] uppercase tracking-[0.16em]">Abgelöst / ersetzt</h3>
            </div>
            <div className="space-y-3">
              {REPLACED.map((r) => (
                <div key={r.before} className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
                  <div className="flex flex-wrap items-center gap-2.5 text-sm">
                    <span className="px-2.5 py-1 rounded-md bg-white/5 text-white/45 line-through decoration-white/30">{r.before}</span>
                    <span className="text-amber-300 font-mono">→</span>
                    <span className="px-2.5 py-1 rounded-md bg-cyan-400/10 text-cyan-200 font-medium">{r.after}</span>
                  </div>
                  <div className="text-white/50 text-[13px] mt-2 leading-relaxed">{r.why}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Entfernt */}
          <div data-reveal>
            <div className="flex items-center gap-2 mb-4 text-red-400">
              <Ban size={16} /><h3 className="font-mono text-[12px] uppercase tracking-[0.16em]">Komplett entfernt / abgelehnt</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {REMOVED.map((r) => (
                <div key={r.title} className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
                  <div className="flex items-center gap-2 text-red-300 font-medium text-sm"><Ban size={14} /> {r.title}</div>
                  <div className="text-white/45 text-[13px] mt-2 leading-relaxed">{r.why}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-white/10 my-14" />

        {/* 3 · Zeitachse */}
        <section id="zeitachse" className="scroll-mt-20">
          <SectionTitle icon={CalendarClock} color={COLOR.victron} kicker="Meilensteine" title="Zeitachse der Ausbaustufen" />
          <div className="relative pl-7 sm:pl-8" data-reveal>
            <div className="absolute left-[9px] sm:left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-400/50 via-cyan-400/30 to-white/10" />
            <div className="space-y-6">
              {TIMELINE.map((m, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-7 sm:-left-8 top-1 grid place-items-center w-[19px] h-[19px] sm:w-[23px] sm:h-[23px] rounded-full border-2 border-cyan-400/60 bg-[#04060c]">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 8px #06B6D4" }} />
                  </span>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300/80">{m.date}</div>
                    <div className="text-white font-medium mt-1">{m.title}</div>
                    <div className="text-white/50 text-[13px] mt-1 leading-relaxed">{m.desc}</div>
                    <div className="mt-3.5 flex items-center gap-2.5" data-testid={`report-mock-pair-${i}`}>
                      <figure className="flex-1 min-w-0 max-w-[132px]">
                        <MiniMock variant={m.before.v} className="w-full h-auto rounded-md" />
                        <figcaption className="mt-1.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/35">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/25" /> Vorher · {m.before.label}
                        </figcaption>
                      </figure>
                      <ArrowRight size={16} className="shrink-0 text-cyan-300/70" />
                      <figure className="flex-1 min-w-0 max-w-[132px]">
                        <MiniMock variant={m.after.v} accent={`${COLOR.battery}55`} className="w-full h-auto rounded-md" />
                        <figcaption className="mt-1.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-cyan-300/70">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Nachher · {m.after.label}
                        </figcaption>
                      </figure>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-white/10 my-14" />

        {/* 4 · Arbeitsweise */}
        <section id="arbeitsweise" className="scroll-mt-20">
          <SectionTitle icon={Workflow} color="#8C92AC" kicker="Vorgehen" title="Arbeitsweise & Verhalten bei Aufgaben" />
          <div className="grid sm:grid-cols-2 gap-3" data-reveal>
            {WORKFLOW.map((w, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex gap-3">
                <span className="grid place-items-center w-7 h-7 shrink-0 rounded-md bg-white/5 text-white/70 font-dseg text-sm">{i + 1}</span>
                <div>
                  <div className="text-white font-medium text-sm">{w.title}</div>
                  <div className="text-white/50 text-[13px] mt-1 leading-relaxed">{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-white/10 my-14" />

        {/* 5 · Erkenntnisse */}
        <section id="erkenntnisse" className="scroll-mt-20">
          <SectionTitle icon={Lightbulb} color={COLOR.pv} kicker="Gelöste Stolpersteine" title="Erlernte Fähigkeiten / Erkenntnisse" />
          <div className="space-y-3" data-reveal>
            {LEARNINGS.map((l, i) => (
              <div key={i} className="rounded-xl border border-amber-300/15 bg-amber-300/[0.03] p-4 flex gap-3">
                <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-amber-300/10 text-amber-300"><Lightbulb size={17} /></span>
                <div>
                  <div className="text-white font-medium text-sm">{l.title}</div>
                  <div className="text-white/50 text-[13px] mt-1 leading-relaxed">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-white/10 my-14" />

        {/* 6 · Technik */}
        <section id="technik" className="scroll-mt-20">
          <SectionTitle icon={Cpu} color={COLOR.battery} kicker="Auf einen Blick" title="Technik-Überblick" />
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 mb-5" data-reveal>
            <div className="flex items-center gap-2 text-white/80"><Server size={16} className="text-cyan-300" /><span className="font-medium text-sm">Lokales Dashboard – läuft vollständig im Heimnetz, ohne Cloud.</span></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div data-reveal>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45 mb-3">Angebundene Geräte</div>
              <div className="space-y-2.5">
                {DEVICES.map((d) => (
                  <div key={d.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
                    <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-white/5 text-cyan-300"><d.icon size={17} /></span>
                    <div><div className="text-white text-sm font-medium">{d.title}</div><div className="text-white/45 text-[12px]">{d.sub}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45 mb-3">Genutzte Bausteine</div>
              <div className="space-y-2.5">
                {BUILDING_BLOCKS.map((b) => (
                  <div key={b.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
                    <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-white/5 text-emerald-300"><b.icon size={17} /></span>
                    <div><div className="text-white text-sm font-medium">{b.title}</div><div className="text-white/45 text-[12px]">{b.sub}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-16 pt-8 border-t border-white/10 text-center" data-reveal>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">{APP_NAME} · {APP_VERSION} · Stand {APP_LAST_UPDATED}</div>
          <div className="text-white/30 text-[12px] mt-2">Reiner Lesebericht · keine Bearbeitung · keine Gerätesteuerung</div>
        </div>
      </main>

      {/* Zurück nach oben */}
      <button
        type="button"
        data-testid="report-back-to-top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-40 grid place-items-center w-11 h-11 rounded-full border border-cyan-400/40 bg-cyan-400/15 text-cyan-200 backdrop-blur-md transition-all duration-300 hover:bg-cyan-400/25 ${
          showTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
        aria-label="Zurück nach oben"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
