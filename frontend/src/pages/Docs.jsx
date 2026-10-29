/* Doku & Roadmap – erreichbar über die Versionsnummer in der Fußleiste.
 * Zwei Ansichten: Roadmap (selbst-aktuell aus lib/appmeta) und Anleitung
 * (App-Bedienung, Anlage, Energiemodell, lokales Setup) mit eingeblendeten
 * aktuellen Werten (Kapazität, Beschriftungen, Modus, erkannte Geräte). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Map, BookOpen, ChevronDown, Monitor, Cpu, Workflow, Server, CircleCheck, Clock, CircleDashed } from "lucide-react";
import { getConfig, getDeviceInfo } from "../lib/api";
import { APP_NAME, APP_VERSION, APP_LAST_UPDATED, ROADMAP, ROADMAP_GROUPS } from "../lib/appmeta";

const STATUS_ICON = { done: CircleCheck, wip: Clock, planned: CircleDashed };

function RoadmapView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" data-testid="roadmap-view">
      {ROADMAP_GROUPS.map((g) => {
        const items = ROADMAP.filter((r) => r.status === g.key);
        const Icon = STATUS_ICON[g.key];
        return (
          <div key={g.key} data-testid={`roadmap-col-${g.key}`}
            className="rounded-xl p-4"
            style={{ background: "linear-gradient(150deg, #0c1526 0%, #070c18 100%)", border: `1px solid ${g.color}33`, boxShadow: `0 0 22px -14px ${g.color}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: g.color }}>
                <Icon size={14} /> {g.title}
              </div>
              <span className="font-mono text-[10px] text-white/40">{items.length}</span>
            </div>
            <ul className="space-y-2.5">
              {items.length === 0 && <li className="font-mono text-[11px] text-white/30">—</li>}
              {items.map((it) => (
                <li key={it.title} className="flex items-start gap-2.5" data-testid="roadmap-item">
                  <span className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: g.color, boxShadow: `0 0 6px ${g.color}` }} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-white/85 leading-snug">{it.title}</div>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/35 mt-0.5">{it.date}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Row({ k, v, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-t border-white/[0.06]">
      <span className="font-mono text-[11px] text-white/50">{k}</span>
      <span className="font-mono text-[12px] text-right" style={{ color: accent || "rgba(255,255,255,0.9)" }}>{v}</span>
    </div>
  );
}

function Section({ icon: Icon, title, accent, open, onToggle, children, testid }) {
  return (
    <div className="rounded-xl overflow-hidden" data-testid={testid}
      style={{ background: "linear-gradient(150deg, #0c1526 0%, #070c18 100%)", border: `1px solid ${accent}2e` }}>
      <button type="button" onClick={onToggle} data-testid={`${testid}-toggle`}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors">
        <span className="flex items-center gap-2.5">
          <span className="grid place-items-center rounded-md" style={{ width: 28, height: 28, background: `${accent}1f`, border: `1px solid ${accent}55` }}>
            <Icon size={15} color={accent} />
          </span>
          <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-white/85">{title}</span>
        </span>
        <ChevronDown size={16} className="text-white/45 transition-transform shrink-0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 text-[13px] text-white/75 leading-relaxed space-y-2">{children}</div>}
    </div>
  );
}

function GuideView({ config, devInfo }) {
  const [open, setOpen] = useState({ app: true });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const labels = config?.display?.labels || {};
  const usable = config?.display?.usable_kwh;
  const demo = config?.demo_mode;
  const dev = (key) => devInfo?.[key];
  const fw = (key) => {
    const d = dev(key);
    const f = d?.firmware;
    if (f && typeof f === "object") return f.current || f.latest || f.version || "–";
    return f || (d?.status === "demo" ? "Demo" : "–");
  };
  const det = (key) => { const d = dev(key); return d?.detected_at ? new Date(d.detected_at).toLocaleString("de-DE") : "noch nicht erkannt"; };

  return (
    <div className="space-y-4 max-w-3xl" data-testid="guide-view">
      <Section testid="guide-app" icon={Monitor} title="App-Bedienung" accent="#06B6D4" open={!!open.app} onToggle={() => toggle("app")}>
        <p><b className="text-white/90">Dashboard:</b> Oben vier Geräte-Karten (Solar PV, Batterie 48 V, Hausverbrauch, Stromnetz) mit Live-Werten, darunter der Energiefluss und eine Kennzahlen-Zeile.</p>
        <p><b className="text-white/90">Energiefluss:</b> Ansicht <span className="text-cyan-300">Auto / Kompakt / Detail</span> (Kompakt = 5 Knoten, Detail = 6), <span className="text-cyan-300">Fluss an/aus</span> schaltet die Partikelanimation, <span className="text-cyan-300">Tempo 1× / 1.5× / 2×</span> regelt die Geschwindigkeit. Knoten anklicken zeigt Details.</p>
        <p><b className="text-white/90">Favoriten:</b> Geräte, MPPT-Strings oder Phasen über den Stern anpinnen – sie erscheinen oben und lassen sich per Ziehen sortieren.</p>
        <p><b className="text-white/90">Einstellungen (Geräte):</b> Demo/Live, IP-Adressen, Standort, nutzbare Akkukapazität und die Karten-Beschriftungen.</p>
        <p><b className="text-white/90">Steuerung:</b> Hoymiles-Begrenzung & Trucki/SUN. <b className="text-white/90">Diagnose:</b> Geräte-Selbsttest. <b className="text-white/90">Verlauf:</b> historische Kurven & Energiebilanz.</p>
      </Section>

      <Section testid="guide-devices" icon={Cpu} title="Anlage & Geräte" accent="#34D399" open={!!open.devices} onToggle={() => toggle("devices")}>
        <div className="rounded-lg border border-white/8 p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-yellow-300/80">Shelly Pro 3EM <span className="text-white/40">· {labels.grid || "Netzzähler"}</span></div>
          <p className="mt-1">3-phasiger Energiezähler am Netzanschlusspunkt (L1/L2/L3). Liefert Bezug/Einspeisung in Echtzeit.</p>
          <Row k="Firmware" v={fw("shelly")} /><Row k="Zuletzt erkannt" v={det("shelly")} />
        </div>
        <div className="rounded-lg border border-white/8 p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-yellow-300/80">Hoymiles HM-1500 · AhoyDTU</div>
          <p className="mt-1">AC-Modulwechselrichter, speist PV-Energie direkt ins Hausnetz; Begrenzung (%) steuerbar über AhoyDTU.</p>
          <Row k="Firmware" v={fw("ahoy")} /><Row k="Zuletzt erkannt" v={det("ahoy")} />
        </div>
        <div className="rounded-lg border border-white/8 p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-300/80">2× Victron SmartSolar MPPT · Venus OS</div>
          <p className="mt-1">Laderegler auf der DC-Seite (Strings 4× 425 Wp & 4× 445 Wp). Laden ausschließlich die Batterie.</p>
          <Row k="Firmware" v={fw("victron")} /><Row k="Zuletzt erkannt" v={det("victron")} />
        </div>
        <div className="rounded-lg border border-white/8 p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300/80">Trucki2Shelly · Lumentree SUN</div>
          <p className="mt-1">RS485-Nulleinspeiser: entlädt die Batterie geregelt auf die AC-Seite und minimiert den Netzbezug.</p>
          <Row k="Firmware" v={fw("trucki")} /><Row k="Zuletzt erkannt" v={det("trucki")} />
        </div>
        <div className="rounded-lg border border-white/8 p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300/80">48 V-LiFePO4-Speicher <span className="text-white/40">· {labels.battery || "Akku"}</span></div>
          <p className="mt-1">Zentraler Gleichstromspeicher. Nutzbare Kapazität (für die Kennzahl „Batterie Kapazität"):</p>
          <Row k="Nutzbare Kapazität" v={`${usable ?? "9,6"} kWh`} accent="#06B6D4" />
        </div>
      </Section>

      <Section testid="guide-model" icon={Workflow} title="Energie- & Verkabelungsmodell" accent="#FACC15" open={!!open.model} onToggle={() => toggle("model")}>
        <p>Das System ist <b className="text-white/90">DC-gekoppelt</b>: Die Victron-MPPT laden die Batterie auf der DC-Seite, der Hoymiles speist PV direkt als AC ins Haus, und der Trucki/SUN entlädt die Batterie geregelt auf die AC-Seite (<b className="text-white/90">Nulleinspeisung</b>).</p>
        <div className="rounded-lg border border-white/8 p-3 font-mono text-[12px] text-cyan-200">
          Hausverbrauch = Hoymiles-AC + SUN-Entladung + Netzfluss (Shelly)
        </div>
        <p className="text-white/55 text-[12px]">Hinweis: Die DC-Ladeleistung der Victron-MPPT lädt nur den Akku und zählt <b>nicht</b> direkt als Hauslast – so werden Doppelzählungen vermieden.</p>
      </Section>

      <Section testid="guide-setup" icon={Server} title="Lokales Setup" accent="#8C92AC" open={!!open.setup} onToggle={() => toggle("setup")}>
        <p><b className="text-white/90">Mosquitto MQTT</b> liefert die Live-Werte (Victron/Venus OS, Shelly, AhoyDTU, Trucki). <b className="text-white/90">InfluxDB</b> speichert Zeitreihen, <b className="text-white/90">Grafana</b> visualisiert sie (Auto-Provisioning).</p>
        <Row k="Aktueller Modus" v={demo === undefined ? "–" : demo ? "Demo (simuliert)" : "Live (lokales Netz)"} accent={demo ? "#FACC15" : "#34D399"} />
        <p className="text-white/55 text-[12px]">Im <b>Demo-Modus</b> werden realistische Werte simuliert (kein Netzwerkzugriff). Für den Echtbetrieb in den Geräte-Einstellungen auf <b>Live</b> umschalten.</p>
      </Section>
    </div>
  );
}

export default function Docs() {
  const [tab, setTab] = useState("roadmap");
  const [config, setConfig] = useState(null);
  const [devInfo, setDevInfo] = useState(null);

  useEffect(() => {
    try { localStorage.setItem("solar.seenVersion", APP_VERSION); } catch { /* ignore */ }
    getConfig().then(setConfig).catch(() => {});
    getDeviceInfo().then((d) => {
      const map = {};
      (d?.devices || []).forEach((x) => { map[x.device] = x; });
      setDevInfo(map);
    }).catch(() => {});
  }, []);

  const TABS = [
    { v: "roadmap", label: "Roadmap", icon: Map },
    { v: "guide", label: "Anleitung", icon: BookOpen },
  ];

  return (
    <div data-testid="docs-page">
      <Link to="/" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200 transition-colors" data-testid="docs-back">
        <ArrowLeft size={13} /> Zurück zum Dashboard
      </Link>
      <div className="flex items-end justify-between gap-4 flex-wrap mt-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white flex items-center gap-3">
            <span className="w-1.5 h-7 rounded-sm" style={{ background: "#06B6D4", boxShadow: "0 0 10px #06B6D4aa" }} />
            Doku & Roadmap
          </h1>
          <p className="text-white/55 text-sm mt-1.5">{APP_NAME} · v{APP_VERSION} · Stand {APP_LAST_UPDATED}</p>
        </div>
        <div className="inline-flex rounded-md overflow-hidden border border-white/12" data-testid="docs-tabs" role="group">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.v} type="button" onClick={() => setTab(t.v)} aria-pressed={tab === t.v}
                data-testid={`docs-tab-${t.v}`}
                className={`inline-flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${tab === t.v ? "bg-cyan-400/20 text-cyan-200" : "text-white/55 hover:text-white hover:bg-white/5"}`}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "roadmap" ? <RoadmapView /> : <GuideView config={config} devInfo={devInfo} />}
    </div>
  );
}
