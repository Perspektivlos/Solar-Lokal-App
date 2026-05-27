import { useEffect, useState } from "react";
import { getConfig, putConfig } from "../lib/api";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

const DEVICES = [
  { key: "shelly", label: "Shelly Pro 3EM", hint: "3-Phasen Energiemesser" },
  { key: "ahoy", label: "Ahoy DTU (Hoymiles HM1500)", hint: "Wechselrichter" },
  { key: "trucki", label: "Trucki2Shelly Gateway", hint: "Akku-Speicher" },
  { key: "victron", label: "Victron VenusOS Large", hint: "2x MPPT 150/35" },
];

export default function Devices() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then(setCfg);
  }, []);

  if (!cfg) return <div className="font-mono text-sm text-gray-600">Lade Konfiguration...</div>;

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
      <div className="flex items-center justify-between border-b border-black pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Geräte</h1>
          <div className="font-mono text-xs text-gray-600 mt-1">IP-Adressen und Demo-Modus</div>
        </div>
        <Button onClick={save} disabled={saving} className="rounded-none bg-black text-white hover:bg-gray-800 font-mono text-xs uppercase tracking-[0.15em]" data-testid="btn-save-devices">
          {saving ? "Speichern..." : "Speichern"}
        </Button>
      </div>

      {/* Demo Mode */}
      <div className="border border-black bg-white p-4 flex items-center justify-between" data-testid="demo-toggle-row">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Demo-Modus</div>
          <div className="text-sm mt-1">
            {cfg.demo_mode ? "Werte werden simuliert (kein lokaler Netzwerkzugriff nötig)." : "Live-Werte werden direkt von den Geräten abgerufen."}
          </div>
        </div>
        <Switch checked={cfg.demo_mode} onCheckedChange={(v) => setCfg({ ...cfg, demo_mode: v })} data-testid="switch-demo" />
      </div>

      {/* Devices */}
      <div className="border border-black bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black text-[10px] uppercase tracking-[0.2em] text-gray-600 font-mono">
              <th className="text-left p-4">Gerät</th>
              <th className="text-left p-4">IP-Adresse</th>
              <th className="text-left p-4 w-32">Aktiv</th>
            </tr>
          </thead>
          <tbody>
            {DEVICES.map((d) => (
              <tr key={d.key} className="border-b border-gray-200" data-testid={`device-row-${d.key}`}>
                <td className="p-4">
                  <div className="font-medium">{d.label}</div>
                  <div className="font-mono text-[10px] text-gray-500">{d.hint}</div>
                </td>
                <td className="p-4">
                  <Input
                    value={cfg.devices[d.key].ip}
                    onChange={(e) => updateDevice(d.key, { ip: e.target.value })}
                    className="rounded-none border-black font-mono max-w-[200px]"
                    data-testid={`input-${d.key}-ip`}
                  />
                </td>
                <td className="p-4">
                  <Switch
                    checked={cfg.devices[d.key].enabled}
                    onCheckedChange={(v) => updateDevice(d.key, { enabled: v })}
                    data-testid={`switch-${d.key}-enabled`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ahoy inverter id */}
      <div className="border border-black bg-white p-4">
        <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Ahoy DTU · Wechselrichter-ID</Label>
        <Input
          type="number"
          value={cfg.devices.ahoy.inverter_id ?? 0}
          onChange={(e) => updateDevice("ahoy", { inverter_id: Number(e.target.value) })}
          className="rounded-none border-black font-mono max-w-[120px] mt-2"
          data-testid="input-ahoy-id"
        />
      </div>
    </div>
  );
}
