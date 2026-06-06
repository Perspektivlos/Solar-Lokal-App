import { useEffect, useState } from "react";
import { getConfig, putConfig } from "../lib/api";
import IntroCard from "../components/IntroCard";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";

const DEVICES = [
  { key: "shelly",  label: "Shelly Pro 3EM",                     hint: "3-Phasen Energiemesser",      accent: "#F87171" },
  { key: "ahoy",    label: "Ahoy DTU (Hoymiles HM1500)",         hint: "Wechselrichter",               accent: "#FACC15" },
  { key: "trucki",  label: "Trucki2Shelly Gateway",              hint: "Akku-Speicher",                accent: "#06B6D4" },
  { key: "victron", label: "Victron VenusOS Large",              hint: "2× SmartSolar MPPT 150/35",    accent: "#34D399" },
];

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

export default function Devices() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getConfig().then(setCfg); }, []);

  if (!cfg) return <div className="font-mono text-sm text-white/55">Lade Konfiguration...</div>;

  const updateDevice = (key, patch) => {
    setCfg({ ...cfg, devices: { ...cfg.devices, [key]: { ...cfg.devices[key], ...patch } } });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await putConfig({ demo_mode: cfg.demo_mode, devices: cfg.devices });
      setCfg(updated);
      toast.success("Konfiguration gespeichert");
    } catch (e) {
      toast.error("Speichern fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
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
        <button onClick={save} disabled={saving}
          className="px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #6ee7b7, #10B981)", boxShadow: "0 0 12px rgba(16,185,129,0.4)" }}
          data-testid="btn-save-devices">
          {saving ? "Speichern..." : "Speichern"}
        </button>
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
          </div>
        ))}
      </div>
    </div>
  );
}
