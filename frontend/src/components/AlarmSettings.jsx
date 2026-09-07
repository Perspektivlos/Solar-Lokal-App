/* Konfigurierbare Alarm-Schwellwerte (Settings-UI).
   Lädt/speichert config.alarms via /api/config. */
import { useEffect, useState } from "react";
import { getConfig, putConfig } from "../lib/api";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import { BellRing, RotateCcw } from "lucide-react";

const DEFAULTS = {
  enabled: true,
  grid_voltage: { under: 207, over: 253, under_crit: 195, over_crit: 265 },
  phase_current: { over: 25, over_crit: 32 },
  battery_voltage: { under: 48, over: 56, under_crit: 46.4, over_crit: 57.6 },
  battery_soc: { under: 15, under_crit: 8 },
};

const GROUPS = [
  {
    key: "grid_voltage", label: "Netzspannung (Shelly-Phasen)", unit: "V", accent: "#F87171",
    fields: [
      { k: "under_crit", label: "Unterspannung kritisch", sev: "crit" },
      { k: "under", label: "Unterspannung Warnung", sev: "warn" },
      { k: "over", label: "Überspannung Warnung", sev: "warn" },
      { k: "over_crit", label: "Überspannung kritisch", sev: "crit" },
    ],
  },
  {
    key: "phase_current", label: "Phasenstrom (Shelly)", unit: "A", accent: "#FB923C",
    fields: [
      { k: "over", label: "Überstrom Warnung", sev: "warn" },
      { k: "over_crit", label: "Überstrom kritisch", sev: "crit" },
    ],
  },
  {
    key: "battery_voltage", label: "Akku-Spannung (Trucki/Victron)", unit: "V", accent: "#06B6D4",
    fields: [
      { k: "under_crit", label: "Unterspannung kritisch", sev: "crit" },
      { k: "under", label: "Unterspannung Warnung", sev: "warn" },
      { k: "over", label: "Überspannung Warnung", sev: "warn" },
      { k: "over_crit", label: "Überspannung kritisch", sev: "crit" },
    ],
  },
  {
    key: "battery_soc", label: "Akku-Ladezustand", unit: "%", accent: "#A78BFA",
    fields: [
      { k: "under_crit", label: "SoC kritisch", sev: "crit" },
      { k: "under", label: "SoC niedrig Warnung", sev: "warn" },
    ],
  },
];

export default function AlarmSettings() {
  const [alarms, setAlarms] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig()
      .then((c) => setAlarms({ ...DEFAULTS, ...(c?.alarms || {}) }))
      .catch(() => setAlarms({ ...DEFAULTS }));
  }, []);

  if (!alarms) return null;

  const setField = (group, field, value) => {
    setAlarms((a) => ({ ...a, [group]: { ...a[group], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await putConfig({ alarms });
      setAlarms({ ...DEFAULTS, ...(updated?.alarms || {}) });
      toast.success("Alarm-Schwellwerte gespeichert");
    } catch (e) {
      toast.error("Speichern fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setAlarms({ ...DEFAULTS });
    toast.info("Standardwerte gesetzt – noch nicht gespeichert");
  };

  return (
    <div className="glass p-4" style={{ borderLeft: "3px solid #FB923C" }} data-testid="alarm-settings">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BellRing size={15} className="text-orange-300" />
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
            Alarm-Schwellwerte
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Alarme aktiv</span>
            <Switch
              checked={alarms.enabled !== false}
              onCheckedChange={(v) => setAlarms((a) => ({ ...a, enabled: v }))}
              data-testid="switch-alarms-enabled"
            />
          </div>
          <button
            onClick={resetDefaults}
            data-testid="btn-alarms-reset"
            className="inline-flex items-center gap-1.5 px-3 py-2 glass font-mono text-[10px] uppercase tracking-[0.16em] text-white/65 hover:text-white transition-colors"
          >
            <RotateCcw size={12} /> Standard
          </button>
          <button
            onClick={save}
            disabled={saving}
            data-testid="btn-alarms-save"
            className="px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, #fdba74, #fb923c)", boxShadow: "0 0 12px rgba(251,146,60,0.4)" }}
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mt-4 ${alarms.enabled === false ? "opacity-40 pointer-events-none" : ""}`}>
        {GROUPS.map((g) => (
          <div key={g.key} data-testid={`alarm-group-${g.key}`}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] mb-2 pb-1 border-b" style={{ color: g.accent, borderColor: `${g.accent}33` }}>
              {g.label}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {g.fields.map((f) => (
                <div key={f.k}>
                  <label className="font-mono text-[10px] text-white/55 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${f.sev === "crit" ? "bg-red-400" : "bg-orange-400"}`} />
                    {f.label}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="0.1"
                      value={alarms[g.key]?.[f.k] ?? ""}
                      onChange={(e) => setField(g.key, f.k, e.target.value === "" ? "" : Number(e.target.value))}
                      className="glass-input w-full px-3 py-2 font-mono text-sm pr-9"
                      data-testid={`alarm-${g.key}-${f.k}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/40">{g.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="font-mono text-[10px] text-white/40 mt-4">
        Verbindungs-Alarme (Gerät nicht erreichbar / MQTT weg / Wechselrichter ohne Daten) sind fest aktiv und im Demo-Modus unterdrückt.
      </div>
    </div>
  );
}
