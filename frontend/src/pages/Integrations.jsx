import { useEffect, useState } from "react";
import { getConfig, putConfig, getIntegrationsStatus } from "../lib/api";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

function StatusBadge({ connected, label, testid }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs" data-testid={testid}>
      <span className={`w-2.5 h-2.5 ${connected ? "bg-green-500 dot-pulse" : "bg-red-500"}`} />
      <span className="uppercase tracking-[0.15em]">{label}: {connected ? "verbunden" : "getrennt"}</span>
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

  if (!cfg) return <div className="font-mono text-sm text-gray-600">Lade...</div>;

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

  const inputCls = "rounded-none border-black font-mono";

  return (
    <div className="space-y-6" data-testid="integrations-page">
      <div className="flex items-center justify-between border-b border-black pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrationen</h1>
          <div className="font-mono text-xs text-gray-600 mt-1">MQTT (Mosquitto) & InfluxDB</div>
        </div>
        <Button onClick={save} disabled={saving} className="rounded-none bg-black text-white hover:bg-gray-800 font-mono text-xs uppercase tracking-[0.15em]" data-testid="btn-save-integrations">
          {saving ? "Speichern..." : "Speichern & Verbinden"}
        </Button>
      </div>

      {/* Status */}
      <div className="border border-black bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="status-row">
        <StatusBadge connected={status?.mqtt?.connected} label="MQTT" testid="status-mqtt" />
        <StatusBadge connected={status?.influx?.connected} label="InfluxDB" testid="status-influx" />
        <StatusBadge connected={!!status?.victron_mqtt?.last_msg} label="Victron-MQTT" testid="status-victron-mqtt" />
        <div className="flex items-center gap-2 font-mono text-xs" data-testid="status-poller">
          <span className={`w-2.5 h-2.5 ${status?.poller?.running ? "bg-green-500 dot-pulse" : "bg-gray-400"}`} />
          <span className="uppercase tracking-[0.15em]">Poller: {status?.poller?.count ?? 0} Snapshots</span>
        </div>
      </div>

      {/* MQTT */}
      <div className="border border-black bg-white" data-testid="card-mqtt">
        <div className="border-b border-black px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">MQTT · Mosquitto</div>
          <Switch checked={cfg.mqtt.enabled} onCheckedChange={(v) => upd("mqtt", { enabled: v })} data-testid="switch-mqtt-enabled" />
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Host</Label>
            <Input value={cfg.mqtt.host} onChange={(e) => upd("mqtt", { host: e.target.value })} className={inputCls} data-testid="input-mqtt-host" />
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Port</Label>
            <Input type="number" value={cfg.mqtt.port} onChange={(e) => upd("mqtt", { port: Number(e.target.value) })} className={inputCls} data-testid="input-mqtt-port" />
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Benutzer</Label>
            <Input value={cfg.mqtt.username} onChange={(e) => upd("mqtt", { username: e.target.value })} className={inputCls} data-testid="input-mqtt-user" />
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Passwort</Label>
            <Input type="password" value={cfg.mqtt.password} onChange={(e) => upd("mqtt", { password: e.target.value })} className={inputCls} data-testid="input-mqtt-pass" />
          </div>
          <div className="md:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Topic-Prefix</Label>
            <Input value={cfg.mqtt.topic_prefix} onChange={(e) => upd("mqtt", { topic_prefix: e.target.value })} className={inputCls} data-testid="input-mqtt-prefix" />
          </div>
          {status?.mqtt?.last_error && (
            <div className="md:col-span-2 font-mono text-xs text-red-600 border border-red-600 p-2">
              Fehler: {status.mqtt.last_error}
            </div>
          )}
        </div>
      </div>

      {/* Victron MQTT Bridge */}
      <div className="border border-black bg-white" data-testid="card-victron-mqtt">
        <div className="border-b border-black px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Victron VenusOS · MQTT-Bridge</div>
          <Switch checked={cfg.victron_mqtt?.enabled} onCheckedChange={(v) => upd("victron_mqtt", { enabled: v })} data-testid="switch-victron-mqtt-enabled" />
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 font-mono text-[11px] text-gray-600 leading-relaxed">
            Liest die beiden MPPT 150/35 live aus VenusOS via MQTT (über Mosquitto-Bridge oben).
            Topics: <code className="bg-gray-100 px-1">N/&lt;VRM-ID&gt;/solarcharger/&lt;Instance&gt;/#</code>.
            Keep-Alive wird automatisch alle 30 s gesendet.
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">VRM Portal-ID</Label>
            <Input value={cfg.victron_mqtt?.vrm_id || ""} onChange={(e) => upd("victron_mqtt", { vrm_id: e.target.value })} className={inputCls} data-testid="input-victron-vrmid" />
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Device-Instances (kommagetrennt)</Label>
            <Input
              value={(cfg.victron_mqtt?.instances || []).join(",")}
              onChange={(e) =>
                upd("victron_mqtt", {
                  instances: e.target.value
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isFinite(n)),
                })
              }
              className={inputCls}
              data-testid="input-victron-instances"
            />
          </div>
          {status?.victron_mqtt && (
            <div className="md:col-span-2 font-mono text-[11px] text-gray-700 border-t border-gray-200 pt-3 space-y-1">
              <div>Letzte Nachricht: <span className="text-black">{status.victron_mqtt.last_msg || "–"}</span></div>
              <div>System PV-Power: <span className="text-[#EAB308]">{status.victron_mqtt.system_pv_power ?? "–"} W</span></div>
              {Object.entries(status.victron_mqtt.instances || {}).map(([id, info]) => (
                <div key={id} data-testid={`victron-mqtt-inst-${id}`}>
                  Instance {id}: {info.fields} Felder · Yield/Power = <span className="text-[#EAB308]">{info.pv_power ?? "–"} W</span> · VBatt {info.battery_voltage ?? "–"} V · State {info.state ?? "–"}
                </div>
              ))}
            </div>
          )}
          {status?.device_mqtt && (
            <div className="md:col-span-2 font-mono text-[11px] text-gray-700 border-t border-gray-200 pt-3 space-y-0.5" data-testid="device-mqtt-status">
              <div className="uppercase tracking-[0.2em] text-gray-500 mb-1">Weitere Geräte via MQTT</div>
              <div>Shelly: <span className="text-black">{status.device_mqtt.shelly_last || "–"}</span></div>
              <div>Ahoy DTU: <span className="text-black">{status.device_mqtt.ahoy_last || "–"}</span></div>
              <div>Trucki: <span className="text-black">{status.device_mqtt.trucki_last || "–"}</span> ({status.device_mqtt.trucki_keys?.length || 0} Keys)</div>
            </div>
          )}
        </div>
      </div>

      {/* Influx */}
      <div className="border border-black bg-white" data-testid="card-influx">
        <div className="border-b border-black px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">InfluxDB 2.x</div>
          <Switch checked={cfg.influx.enabled} onCheckedChange={(v) => upd("influx", { enabled: v })} data-testid="switch-influx-enabled" />
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">URL</Label>
            <Input value={cfg.influx.url} onChange={(e) => upd("influx", { url: e.target.value })} className={inputCls} data-testid="input-influx-url" />
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Organisation</Label>
            <Input value={cfg.influx.org} onChange={(e) => upd("influx", { org: e.target.value })} className={inputCls} data-testid="input-influx-org" />
          </div>
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Bucket</Label>
            <Input value={cfg.influx.bucket} onChange={(e) => upd("influx", { bucket: e.target.value })} className={inputCls} data-testid="input-influx-bucket" />
          </div>
          <div className="md:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Token</Label>
            <Input type="password" value={cfg.influx.token} onChange={(e) => upd("influx", { token: e.target.value })} className={inputCls} data-testid="input-influx-token" />
          </div>
          {status?.influx?.last_error && (
            <div className="md:col-span-2 font-mono text-xs text-red-600 border border-red-600 p-2">
              Fehler: {status.influx.last_error}
            </div>
          )}
          <div className="md:col-span-2 font-mono text-xs text-gray-600">
            Writes: {status?.influx?.writes ?? 0}
          </div>
        </div>
      </div>
    </div>
  );
}
