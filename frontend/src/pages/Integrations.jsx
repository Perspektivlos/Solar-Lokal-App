import { useEffect, useState } from "react";
import { getConfig, putConfig, getIntegrationsStatus } from "../lib/api";
import IntroCard from "../components/IntroCard";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Konfiguriert die drei externen Integrationen: Mosquitto MQTT (Subscriber für alle 4 Geräte), InfluxDB 2.x (paralleler Time-Series-Writer), Victron VenusOS MQTT-Bridge (D-Bus-Daten der MPPTs).",
  },
  {
    label: "MQTT (Mosquitto)",
    body: <span><b>Host/Port/User/Pass</b>: Verbindungsdaten zum lokalen Broker. <b>Topic-Prefix</b>: zusätzlicher generischer Subscribe (z.&nbsp;B. <code className="text-cyan-300">solar/</code>). Automatisch abonniert: <code className="text-cyan-300">venus/pv/ahoydtu/#</code>, <code className="text-cyan-300">venus/grid/shellypro/#</code>, <code className="text-cyan-300">Trucki/#</code>.</span>,
  },
  {
    label: "Victron MQTT-Bridge",
    body: <span><b>VRM Portal-ID</b>: aus VenusOS unter <i>Settings → VRM online portal</i>. <b>Device-Instances</b>: kommagetrennt (z.&nbsp;B. <code className="text-cyan-300">288,289</code>). Abo: <code className="text-cyan-300">N/&lt;vrm&gt;/#</code>. Backend sendet alle 30&nbsp;s <code className="text-cyan-300">R/&lt;vrm&gt;/keepalive</code>, damit VenusOS Daten publiziert.</span>,
  },
  {
    label: "InfluxDB 2.x",
    body: <span><b>URL/Org/Bucket/Token</b>: Standard-InfluxDB-2-Verbindung. Backend schreibt parallel zu MongoDB pro Snapshot (alle 15&nbsp;s) Felder <code className="text-cyan-300">pv_power, grid_power, battery_power, house_power, battery_soc</code> in Measurement <code className="text-cyan-300">solar</code>.</span>,
  },
  {
    label: "Status-Anzeige",
    body: <span>Live unter <code className="text-cyan-300">/api/integrations/status</code>. Grüner Dot = verbunden · Nachrichten/Write-Counter zeigt Aktivität. <b>Speichern & Verbinden</b> baut die Verbindungen neu auf.</span>,
  },
  {
    label: "Mögliche Fehler",
    body: <span><b>MQTT rc=4/5</b> = Auth-Fehler · <b>rc=3</b> = Server unavailable · InfluxDB-Fehler im UI sichtbar als <code className="text-cyan-300">last_error</code>. Victron-Bridge: ohne aktives Keep-Alive publiziert VenusOS nur selten — wir senden es automatisch.</span>,
  },
];

function StatusBadge({ connected, label, testid }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-white/80" data-testid={testid}>
      <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-400 dot-pulse text-emerald-400" : "bg-red-400/60"}`} />
      <span className="uppercase tracking-[0.15em]">
        {label}: <span className={connected ? "text-emerald-300" : "text-red-300"}>{connected ? "verbunden" : "getrennt"}</span>
      </span>
    </div>
  );
}

function Section({ title, accent, enabled, onToggle, testid, switchTestid, children }) {
  return (
    <div className="glass" style={{ borderLeft: `3px solid ${accent}`, boxShadow: `0 0 24px -16px ${accent}aa` }} data-testid={testid}>
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">{title}</div>
        <Switch checked={!!enabled} onCheckedChange={onToggle} data-testid={switchTestid} />
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, colspan, ...inputProps }) {
  return (
    <div className={colspan ? "md:col-span-2" : ""}>
      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">{label}</label>
      <input {...inputProps} className="glass-input w-full px-3 py-2 font-mono text-sm mt-1" />
    </div>
  );
}

export default function Integrations() {
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then(setCfg);
    const tick = () => getIntegrationsStatus().then(setStatus).catch(() => {});
    tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, []);

  if (!cfg) return <div className="font-mono text-sm text-white/55">Lade...</div>;

  const upd = (group, patch) => setCfg({ ...cfg, [group]: { ...cfg[group], ...patch } });

  const save = async () => {
    setSaving(true);
    try {
      const r = await putConfig({ mqtt: cfg.mqtt, influx: cfg.influx, victron_mqtt: cfg.victron_mqtt });
      setCfg(r);
      toast.success("Integrationen aktualisiert");
    } catch (e) {
      toast.error("Speichern fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="integrations-page">
      <IntroCard title="Integrationen" subtitle="MQTT (Mosquitto) · InfluxDB · Victron-Bridge" sections={INTRO_SECTIONS} accent="#06B6D4" testid="intro-integrations" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
          <span className="w-1.5 h-7 rounded-sm" style={{ background: "#06B6D4", boxShadow: "0 0 10px #06B6D488" }} />
          Integrationen
        </h1>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #67e8f9, #06B6D4)", boxShadow: "0 0 12px rgba(6,182,212,0.4)" }}
          data-testid="btn-save-integrations">
          {saving ? "Speichern..." : "Speichern & Verbinden"}
        </button>
      </div>

      {/* Status overview */}
      <div className="glass p-4 grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="status-row">
        <StatusBadge connected={status?.mqtt?.connected} label="MQTT" testid="status-mqtt" />
        <StatusBadge connected={status?.influx?.connected} label="InfluxDB" testid="status-influx" />
        <StatusBadge connected={!!status?.victron_mqtt?.last_msg} label="Victron-MQTT" testid="status-victron-mqtt" />
        <div className="flex items-center gap-2 font-mono text-xs text-white/80" data-testid="status-poller">
          <span className={`w-2.5 h-2.5 rounded-full ${status?.poller?.running ? "bg-emerald-400 dot-pulse text-emerald-400" : "bg-white/30"}`} />
          <span className="uppercase tracking-[0.15em]">Poller: <span className="text-white">{status?.poller?.count ?? 0}</span> Snapshots</span>
        </div>
      </div>

      {/* MQTT */}
      <Section title="MQTT · Mosquitto" accent="#06B6D4" enabled={cfg.mqtt.enabled} onToggle={(v) => upd("mqtt", { enabled: v })} testid="card-mqtt" switchTestid="switch-mqtt-enabled">
        <Field label="Host" data-testid="input-mqtt-host" value={cfg.mqtt.host} onChange={(e) => upd("mqtt", { host: e.target.value })} />
        <Field label="Port" type="number" data-testid="input-mqtt-port" value={cfg.mqtt.port} onChange={(e) => upd("mqtt", { port: Number(e.target.value) })} />
        <Field label="Benutzer" data-testid="input-mqtt-user" value={cfg.mqtt.username} onChange={(e) => upd("mqtt", { username: e.target.value })} />
        <Field label="Passwort" type="password" data-testid="input-mqtt-pass" value={cfg.mqtt.password} onChange={(e) => upd("mqtt", { password: e.target.value })} />
        <Field label="Topic-Prefix" colspan data-testid="input-mqtt-prefix" value={cfg.mqtt.topic_prefix} onChange={(e) => upd("mqtt", { topic_prefix: e.target.value })} />
        {status?.mqtt?.last_error && (
          <div className="md:col-span-2 font-mono text-xs text-red-300 border border-red-400/30 bg-red-400/5 p-2 rounded">
            Fehler: {status.mqtt.last_error}
          </div>
        )}
        {status?.device_mqtt && (
          <div className="md:col-span-2 font-mono text-[11px] text-white/70 border-t border-white/10 pt-3 space-y-0.5" data-testid="device-mqtt-status">
            <div className="uppercase tracking-[0.2em] text-white/45 mb-1">Weitere Geräte via MQTT</div>
            <div>Shelly: <span className="text-white">{status.device_mqtt.shelly_last || "–"}</span></div>
            <div>Ahoy DTU: <span className="text-white">{status.device_mqtt.ahoy_last || "–"}</span></div>
            <div>Trucki: <span className="text-white">{status.device_mqtt.trucki_last || "–"}</span> ({status.device_mqtt.trucki_keys?.length || 0} Keys)</div>
          </div>
        )}
      </Section>

      {/* Victron MQTT Bridge */}
      <Section title="Victron VenusOS · MQTT-Bridge" accent="#34D399" enabled={cfg.victron_mqtt?.enabled} onToggle={(v) => upd("victron_mqtt", { enabled: v })} testid="card-victron-mqtt" switchTestid="switch-victron-mqtt-enabled">
        <div className="md:col-span-2 font-mono text-[11px] text-white/60 leading-relaxed">
          Liest die MPPT-Lader aus VenusOS via MQTT. Topics:&nbsp;
          <code className="text-cyan-300">N/&lt;VRM-ID&gt;/solarcharger/&lt;Instance&gt;/#</code>. Keep-Alive automatisch alle 30&nbsp;s.
        </div>
        <Field label="VRM Portal-ID" data-testid="input-victron-vrmid" value={cfg.victron_mqtt?.vrm_id || ""} onChange={(e) => upd("victron_mqtt", { vrm_id: e.target.value })} />
        <Field label="Device-Instances (kommagetrennt)" data-testid="input-victron-instances"
               value={(cfg.victron_mqtt?.instances || []).join(",")}
               onChange={(e) => upd("victron_mqtt", { instances: e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)) })} />
        {status?.victron_mqtt && (
          <div className="md:col-span-2 font-mono text-[11px] text-white/70 border-t border-white/10 pt-3 space-y-1">
            <div>Letzte Nachricht: <span className="text-white">{status.victron_mqtt.last_msg || "–"}</span></div>
            <div>System PV-Power: <span className="text-yellow-300">{status.victron_mqtt.system_pv_power ?? "–"} W</span></div>
            {Object.entries(status.victron_mqtt.instances || {}).map(([id, info]) => (
              <div key={id} data-testid={`victron-mqtt-inst-${id}`}>
                Instance {id}: {info.fields} Felder · Yield/Power = <span className="text-yellow-300">{info.pv_power ?? "–"} W</span>
                {info.battery_voltage !== undefined && info.battery_voltage !== null && (
                  <span> · VBatt {info.battery_voltage} V · State {info.state ?? "–"}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Influx */}
      <Section title="InfluxDB 2.x" accent="#A78BFA" enabled={cfg.influx.enabled} onToggle={(v) => upd("influx", { enabled: v })} testid="card-influx" switchTestid="switch-influx-enabled">
        <Field label="URL" colspan data-testid="input-influx-url" value={cfg.influx.url} onChange={(e) => upd("influx", { url: e.target.value })} />
        <Field label="Organisation" data-testid="input-influx-org" value={cfg.influx.org} onChange={(e) => upd("influx", { org: e.target.value })} />
        <Field label="Bucket" data-testid="input-influx-bucket" value={cfg.influx.bucket} onChange={(e) => upd("influx", { bucket: e.target.value })} />
        <Field label="Token" type="password" colspan data-testid="input-influx-token" value={cfg.influx.token} onChange={(e) => upd("influx", { token: e.target.value })} />
        {status?.influx?.last_error && (
          <div className="md:col-span-2 font-mono text-xs text-red-300 border border-red-400/30 bg-red-400/5 p-2 rounded">
            Fehler: {status.influx.last_error}
          </div>
        )}
        <div className="md:col-span-2 font-mono text-xs text-white/55">
          Writes: <span className="text-white">{status?.influx?.writes ?? 0}</span>
        </div>
      </Section>
    </div>
  );
}
