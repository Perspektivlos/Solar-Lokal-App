import { useEffect, useState } from "react";
import { getConfig, putConfig, getDeviceInfo, discoverDevice, discoverAll } from "../lib/api";
import IntroCard from "../components/IntroCard";
import AlarmSettings from "../components/AlarmSettings";
import DeviceDocPanel from "../components/DeviceDocPanel";
import { Switch } from "../components/ui/switch";
import { useMotion } from "../lib/motion";
import { ScanLine, Loader2 } from "lucide-react";
import { toast } from "sonner";

// cards = Texte der Dashboard-Karten, die zu diesem Gerät gehören
const DEVICES = [
  { key: "shelly",  label: "Shelly Pro 3EM",                     hint: "3-Phasen Energiemesser",      accent: "#F87171", cards: [{ k: "grid", l: "Stromnetz" }, { k: "house", l: "Hausverbrauch" }] },
  { key: "ahoy",    label: "Ahoy DTU (Hoymiles HM1500)",         hint: "Wechselrichter",               accent: "#FACC15", cards: [{ k: "solar", l: "Solar PV" }] },
  { key: "trucki",  label: "Trucki2Shelly Gateway",              hint: "Akku-Speicher",                accent: "#06B6D4", cards: [{ k: "battery", l: "Batterie 48V" }] },
  { key: "victron", label: "Victron VenusOS Large",              hint: "2× SmartSolar MPPT 150/35",    accent: "#34D399", cards: [] },
];

const MODULE_V = [12.8, 25.6, 51.2];
const SYS_V = 51.2;
const de = (n, d = 1) => n.toLocaleString("de-DE", { maximumFractionDigits: d });

// Akku-Rechner: Module (V × Ah × Anzahl) × nutzbarer Anteil → nutzbare kWh
function BatteryCalc({ calc, usable, onChange }) {
  const c = { v: 0, ah: 100, count: 6, pct: 90, ...(calc || {}) };
  const valid = (n) => n.v > 0 && n.ah > 0 && n.count > 0 && n.pct > 0;
  const kwhOf = (n) => Math.round(((n.v * n.ah * n.count) / 1000) * (n.pct / 100) * 10) / 10;
  const set = (patch) => {
    const n = { ...c, ...patch };
    onChange(n, valid(n) ? kwhOf(n) : null);
  };
  const num = (e) => (e.target.value === "" ? "" : Number(e.target.value));
  const ok = valid(c);
  const nominal = ok ? (c.v * c.ah * c.count) / 1000 : 0;
  const overridden = ok && typeof usable === "number" && Math.abs(usable - kwhOf(c)) > 0.05;
  const s = c.v > 0 ? Math.max(1, Math.round(SYS_V / c.v)) : 1;
  const fits = c.count % s === 0;
  const lbl = "font-mono text-[10px] uppercase tracking-[0.22em] text-white/55";
  const inp = "glass-input w-full px-3 py-2 font-mono text-sm mt-1";

  return (
    <div className="sm:col-span-2 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.03] p-3" data-testid="battery-calc">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">Akku-Rechner</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
        <div>
          <label className={lbl}>Modul (V)</label>
          <select value={c.v || ""} onChange={(e) => set({ v: Number(e.target.value) })} className={`${inp} bg-transparent`} data-testid="calc-module-v">
            <option value="">wählen</option>
            {MODULE_V.map((v) => <option key={v} value={v}>{de(v)} V</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Ah je Modul</label>
          <input type="number" min="1" value={c.ah} onChange={(e) => set({ ah: num(e) })} className={inp} data-testid="calc-module-ah" />
        </div>
        <div>
          <label className={lbl}>Anzahl</label>
          <input type="number" min="1" value={c.count} onChange={(e) => set({ count: num(e) })} className={inp} data-testid="calc-module-count" />
        </div>
        <div>
          <label className={lbl}>Nutzbar (%)</label>
          <input type="number" min="1" max="100" value={c.pct} onChange={(e) => set({ pct: num(e) })} className={inp} data-testid="calc-usable-pct" />
        </div>
      </div>
      <div className="mt-3 font-mono text-[11px] text-white/60" data-testid="calc-result">
        {!ok ? (c.v > 0 ? "Bitte Ah, Anzahl und Nutzbar (%) ausfüllen." : "Modulspannung wählen – die nutzbaren kWh werden automatisch übernommen.") : (
          <>
            {fits
              ? <span>Schaltung {s}S{c.count / s}P · {de(s * c.v)} V · {de(c.ah * (c.count / s), 0)} Ah</span>
              : <span className="text-amber-300">Anzahl passt nicht zu 48 V (Vielfaches von {s} nötig)</span>}
            <span className="text-white/30"> · </span>
            {de(nominal, 2)} kWh nominal → <span className="text-cyan-300">{de(nominal * (c.pct / 100))} kWh nutzbar</span>
          </>
        )}
      </div>
      {overridden && (
        <div className="mt-1.5 font-mono text-[10px] text-amber-300/90" data-testid="calc-override-hint">
          Feld „Nutzbare Kapazität" manuell auf {de(usable)} kWh gesetzt – der Rechner-Wert wird bei der nächsten Änderung übernommen.
        </div>
      )}
    </div>
  );
}

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Konfiguration aller vier physischen Geräte: IP-Adresse, Aktiv-Status. Globaler Schalter ‚Demo-Modus' wechselt zwischen Mock-Werten und Live-Abruf aus dem lokalen Netz.",
  },
  {
    label: "Parameter pro Gerät",
    body: <span><b>IP-Adresse</b>: erreichbar im LAN (192.168.x.x). <b>Aktiv</b>: deaktivierte Geräte werden weder via MQTT noch HTTP abgefragt — ihre Werte sind in Live-Daten leer.</span>,
  },
  {
    label: "Ahoy-Inverter-ID",
    body: "Bei mehreren Wechselrichtern an einer Ahoy DTU wählt diese ID aus, welcher abgefragt wird. Default = 0 (erster WR).",
  },
  {
    label: "Demo-Modus",
    body: "Erzeugt realistische Mock-Werte (Sonnenkurve, 3-Phasen-Last, SoC-Drift) ohne Zugriff auf echte Geräte. Wird für Cloud-Demo und Entwicklung benutzt. Deaktivieren, sobald die App im lokalen Netz läuft.",
  },
  {
    label: "Speicherung",
    body: <span>Konfiguration wird in MongoDB (<code className="text-cyan-300">db.config._id=&apos;main&apos;</code>) persistiert. Nach ‚Speichern&rsquo; werden MQTT- und InfluxDB-Verbindungen neu aufgebaut.</span>,
  },
  {
    label: "Mögliche Fehler",
    body: "Falsche IP → Live-Aufruf endet im FALLBACK-Badge (Geräte-Card zeigt Mock-Werte mit ‚online: false'). Per-Gerät-Status sichtbar unter Diagnose → Selbst-Test.",
  },
];

const MOTION_OPTS = [
  { v: "auto", label: "Automatisch" },
  { v: "off", label: "Immer an" },
  { v: "on", label: "Reduziert" },
];

export default function Devices() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState({});
  const [expanded, setExpanded] = useState({});
  const [discovering, setDiscovering] = useState({});
  const [discoveringAll, setDiscoveringAll] = useState(false);
  const { pref: motionPref, setPref: setMotionPref } = useMotion();

  useEffect(() => { getConfig().then(setCfg); }, []);
  useEffect(() => {
    getDeviceInfo().then((d) => {
      const map = {};
      (d.devices || []).forEach((x) => { map[x.device] = x; });
      setInfo(map);
    }).catch(() => {});
  }, []);

  if (!cfg) return <div className="font-mono text-sm text-white/55">Lade Konfiguration...</div>;

  const updateDevice = (key, patch) => {
    setCfg({ ...cfg, devices: { ...cfg.devices, [key]: { ...cfg.devices[key], ...patch } } });
  };

  const updateLocation = (patch) => setCfg({ ...cfg, location: { ...(cfg.location || {}), ...patch } });
  const updateDisplay = (patch) => setCfg({ ...cfg, display: { ...(cfg.display || {}), ...patch } });
  const updateLabel = (key, val) => setCfg({ ...cfg, display: { ...(cfg.display || {}), labels: { ...((cfg.display || {}).labels || {}), [key]: val } } });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await putConfig({ demo_mode: cfg.demo_mode, devices: cfg.devices, location: cfg.location, display: cfg.display });
      setCfg(updated);
      toast.success("Konfiguration gespeichert");
    } catch (e) {
      toast.error("Speichern fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const runDiscover = async (key) => {
    setDiscovering((s) => ({ ...s, [key]: true }));
    try {
      const doc = await discoverDevice(key);
      setInfo((m) => ({ ...m, [key]: doc }));
      setExpanded((e) => ({ ...e, [key]: true }));
      if (doc.status === "error") toast.error(`${doc.device_label}: ${doc.error}`);
      else toast.success(`${doc.device_label} erkannt${doc.status === "demo" ? " (Demo)" : ""}`);
    } catch (e) {
      toast.error("Erkennung fehlgeschlagen: " + e.message);
    } finally {
      setDiscovering((s) => ({ ...s, [key]: false }));
    }
  };

  const runDiscoverAll = async () => {
    setDiscoveringAll(true);
    try {
      const d = await discoverAll();
      setInfo((m) => {
        const map = { ...m };
        (d.devices || []).forEach((x) => { map[x.device] = x; });
        return map;
      });
      const nErr = (d.devices || []).filter((x) => x.status === "error").length;
      if (nErr) toast.warning(`Erkennung abgeschlossen · ${nErr} Gerät(e) nicht erreichbar`);
      else toast.success("Alle Geräte erkannt");
    } catch (e) {
      toast.error("Erkennung fehlgeschlagen: " + e.message);
    } finally {
      setDiscoveringAll(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="devices-page">
      <IntroCard title="Geräte" subtitle="IP-Adressen, Aktiv-Status und Demo-Modus" sections={INTRO_SECTIONS} accent="#34D399" testid="intro-devices" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
          <span className="w-1.5 h-7 rounded-sm" style={{ background: "#34D399", boxShadow: "0 0 10px #34D39988" }} />
          Geräte
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={runDiscoverAll} disabled={discoveringAll}
            className="inline-flex items-center gap-2 px-4 py-2 glass font-mono text-xs uppercase tracking-[0.14em] text-white/80 hover:text-cyan-300 hover:border-cyan-400/40 transition-colors disabled:opacity-50"
            data-testid="btn-discover-all">
            {discoveringAll ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} className="text-cyan-400" />}
            {discoveringAll ? "Erkenne…" : "Alle erkennen"}
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, #6ee7b7, #10B981)", boxShadow: "0 0 12px rgba(16,185,129,0.4)" }}
            data-testid="btn-save-devices">
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>

      {/* Demo Mode */}
      <div className="glass p-4 flex items-center justify-between" style={{ borderLeft: "3px solid #FACC15" }} data-testid="demo-toggle-row">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-300/80">Demo-Modus</div>
          <div className="text-sm mt-1 text-white/85">
            {cfg.demo_mode
              ? "Werte werden simuliert (Sonnenkurve, 3-Phasen-Last, SoC-Drift). Kein Netzwerkzugriff erforderlich."
              : "Live-Werte werden direkt von den Geräten abgerufen (MQTT bevorzugt, sonst HTTP)."}
          </div>
        </div>
        <Switch checked={cfg.demo_mode} onCheckedChange={(v) => setCfg({ ...cfg, demo_mode: v })} data-testid="switch-demo" />
      </div>

      {/* Darstellung · Animationen (Reduced-Motion-Option) */}
      <div className="glass p-4" style={{ borderLeft: "3px solid #06B6D4" }} data-testid="motion-row">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">Darstellung · Animationen</div>
            <div className="text-sm mt-1 text-white/70">
              Energiefluss, Sonnenbogen &amp; gestaffelte Einblendungen. „Automatisch&ldquo; folgt der System-Einstellung
              (<code className="text-cyan-300">prefers-reduced-motion</code>), „Reduziert&ldquo; blendet Bewegung dezent ab.
            </div>
          </div>
          <div className="inline-flex rounded-md overflow-hidden border border-white/12 shrink-0" data-testid="motion-toggle" role="group" aria-label="Animationen">
            {MOTION_OPTS.map((o) => (
              <button key={o.v} type="button" onClick={() => setMotionPref(o.v)}
                aria-pressed={motionPref === o.v}
                data-testid={`motion-opt-${o.v}`}
                className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${motionPref === o.v ? "bg-cyan-400/20 text-cyan-200" : "text-white/55 hover:text-white hover:bg-white/5"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Standort für Sonnenzeiten */}
      <div className="glass p-4" style={{ borderLeft: "3px solid #FACC15" }} data-testid="location-row">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-300/80">Standort · Sonnenzeiten</div>
        <div className="text-sm mt-1 text-white/70">Auf- &amp; Untergang werden aus Datum &amp; Standort berechnet (Tagesverlauf &amp; „Sonnenaufgang in X h&ldquo;).</div>
        <div className="flex flex-wrap gap-4 mt-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Breitengrad</label>
            <input type="number" step="0.0001" value={cfg.location?.lat ?? ""} onChange={(e) => updateLocation({ lat: Number(e.target.value) })}
                   className="glass-input w-36 px-3 py-2 font-mono text-sm mt-1 block" data-testid="input-lat" />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Längengrad</label>
            <input type="number" step="0.0001" value={cfg.location?.lon ?? ""} onChange={(e) => updateLocation({ lon: Number(e.target.value) })}
                   className="glass-input w-36 px-3 py-2 font-mono text-sm mt-1 block" data-testid="input-lon" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Bezeichnung</label>
            <input type="text" value={cfg.location?.name ?? ""} onChange={(e) => updateLocation({ name: e.target.value })}
                   className="glass-input w-full px-3 py-2 font-mono text-sm mt-1 block" data-testid="input-loc-name" />
          </div>
        </div>
      </div>

      {/* Devices grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEVICES.map((d) => (
          <div key={d.key} className="glass p-4" style={{ borderLeft: `3px solid ${d.accent}`, boxShadow: `0 0 24px -16px ${d.accent}aa` }} data-testid={`device-row-${d.key}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{d.label}</div>
                <div className="font-mono text-[10px] text-white/45 mt-0.5">{d.hint}</div>
              </div>
              <Switch checked={cfg.devices[d.key].enabled} onCheckedChange={(v) => updateDevice(d.key, { enabled: v })} data-testid={`switch-${d.key}-enabled`} />
            </div>
            <div className="mt-3">
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">IP-Adresse</label>
              <input value={cfg.devices[d.key].ip} onChange={(e) => updateDevice(d.key, { ip: e.target.value })}
                     className="glass-input w-full px-3 py-2 font-mono text-sm mt-1" data-testid={`input-${d.key}-ip`} />
            </div>
            {d.key === "ahoy" && (
              <div className="mt-3">
                <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Wechselrichter-ID</label>
                <input type="number" value={cfg.devices.ahoy.inverter_id ?? 0}
                       onChange={(e) => updateDevice("ahoy", { inverter_id: Number(e.target.value) })}
                       className="glass-input w-32 px-3 py-2 font-mono text-sm mt-1" data-testid="input-ahoy-id" />
              </div>
            )}
            {(d.cards.length > 0 || d.key === "trucki") && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid={`device-display-${d.key}`}>
                {d.cards.map((c) => (
                  <div key={c.k}>
                    <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Karte „{c.l}" · Text</label>
                    <input type="text" value={cfg.display?.labels?.[c.k] ?? ""} onChange={(e) => updateLabel(c.k, e.target.value)}
                           className="glass-input w-full px-3 py-2 font-mono text-sm mt-1" data-testid={`input-label-${c.k}`} />
                  </div>
                ))}
                {d.key === "trucki" && (
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Nutzbare Kapazität (kWh)</label>
                    <input type="number" step="0.1" min="0" value={cfg.display?.usable_kwh ?? ""}
                           onChange={(e) => updateDisplay({ usable_kwh: Number(e.target.value) })}
                           className="glass-input w-full px-3 py-2 font-mono text-sm mt-1" data-testid="input-usable-kwh" />
                  </div>
                )}
                {d.key === "trucki" && (
                  <BatteryCalc calc={cfg.display?.battery_calc} usable={cfg.display?.usable_kwh}
                    onChange={(calc, kwh) => updateDisplay({ battery_calc: calc, ...(kwh != null ? { usable_kwh: kwh } : {}) })} />
                )}
              </div>
            )}
            <DeviceDocPanel
              deviceKey={d.key}
              accent={d.accent}
              info={info[d.key]}
              discovering={!!discovering[d.key]}
              expanded={!!expanded[d.key]}
              onToggle={() => setExpanded((e) => ({ ...e, [d.key]: !e[d.key] }))}
              onDiscover={() => runDiscover(d.key)}
            />
          </div>
        ))}
      </div>

      {/* Alarm-Schwellwerte (konfigurierbar) */}
      <AlarmSettings />
    </div>
  );
}
