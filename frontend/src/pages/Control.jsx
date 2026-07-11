import { useState, useMemo } from "react";
import { controlHoymiles, controlTrucki } from "../lib/api";
import IntroCard from "../components/IntroCard";
import { Slider } from "../components/ui/slider";
import { Power, RotateCw, Send } from "lucide-react";

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Direkte Befehle an den Hoymiles HM1500 (via Ahoy DTU /api/ctrl) und den Trucki-Speicher (MQTT-Overrides). Jeder Befehl wird einmalig gesendet und das Roh-JSON/Text-Response unter dem jeweiligen Panel angezeigt.",
  },
  {
    label: "Hoymiles · Parameter",
    body: <span><b>Limit (%)</b>: 0–100, nicht-persistent, mit Live-Slider · <b>Power ON/OFF</b>: schaltet WR an/aus · <b>Restart</b>: WR-Neustart (Verbindungsabbruch ~30 s). Endpoint: <code className="text-cyan-300">POST /api/control/hoymiles</code> {"{action, value}"}.</span>,
  },
  {
    label: "Trucki · AC-Steuerung",
    body: <span><b>AC-Setpoint (W)</b>: Ziel-Einspeise-Leistung (0–MAX). Sendet zu MQTT-Topic <code className="text-cyan-300">Trucki/ACSETPOINTOVR</code>. <b>ZEPC ON/OFF</b> → <code className="text-cyan-300">Trucki/ZEPCOVR</code>. <b>Restart</b> → <code className="text-cyan-300">Trucki/REBOOTOVR</code>.</span>,
  },
  {
    label: "Trucki · Settings",
    body: <span><b>TARGET</b>: Soll-Netzbezug für ZEPC (W) → <code className="text-cyan-300">Trucki/TARGETOVR</code> · <b>MIN/MAX</b>: untere und obere Leistungsschranke → <code className="text-cyan-300">Trucki/MINPOWEROVR</code> / <code className="text-cyan-300">MAXPOWEROVR</code>. Überschreiben dauerhaft die im Trucki-Webinterface gesetzten Werte.</span>,
  },
  {
    label: "Rückgabewerte",
    body: <span>Antwort als JSON: <code className="text-cyan-300">{"{ok:true|false, via:'mqtt'|'http', response:…}"}</code> · im Demo-Modus zusätzlich <code className="text-cyan-300">demo:true</code>.</span>,
  },
  {
    label: "Mögliche Fehler",
    body: "HTTP 502 = MQTT-Broker oder Gerät nicht erreichbar. HTTP 400 = ungültige Aktion. Im Demo-Modus geben alle Befehle eine simulierte Erfolgs-Antwort zurück und es passiert physikalisch nichts.",
  },
];

function Result({ res }) {
  if (!res) return null;
  return (
    <pre className="mt-2 p-2 glass-inset font-mono text-[11px] overflow-x-auto text-white/85" data-testid="control-result">
      {JSON.stringify(res, null, 2)}
    </pre>
  );
}

function Panel({ title, accent, children, testid }) {
  return (
    <div className="glass" style={{ borderLeft: `3px solid ${accent}`, boxShadow: `0 0 24px -16px ${accent}88` }} data-testid={testid}>
      <div className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">
        {title}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

/**
 * Rendert eine Schaltfläche mit einheitlicher Neo-Button-Gestaltung.
 * @param {React.ReactNode} children - Inhalt der Schaltfläche.
 * @param {Object} props - Weitere Eigenschaften für das native Button-Element.
 * @returns {JSX.Element} Das gestaltete Button-Element.
 */
function NeoButton({ children, ...props }) {
  return (
    <button {...props} className={`btn-neo px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ""}`}>
      {children}
    </button>
  );
}

/**
 * Rendert eine hervorgehobene Schaltfläche mit akzentbasierter Farbgestaltung.
 * @param {React.ReactNode} children - Inhalt der Schaltfläche.
 * @param {string} [accent="#06B6D4"] - Akzentfarbe für Hintergrundverlauf und Schatten.
 * @returns {JSX.Element} Die gestaltete Schaltfläche.
 */
function PrimaryButton({ children, accent = "#06B6D4", ...props }) {
  return (
    <button {...props} className={`px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50 ${props.className || ""}`}
      style={{ background: `linear-gradient(180deg, ${accent}cc, ${accent})`, boxShadow: `0 0 12px ${accent}73` }}>
      {children}
    </button>
  );
}

/**
 * Stellt eine Schieberegelung mit Werteanzeige und Senden-Schaltfläche dar.
 * @param {string} label - Bezeichnung der Regelung.
 * @param {number} value - Aktueller Wert der Regelung.
 * @param {Function} onChange - Callback für Änderungen des Schiebereglers.
 * @param {Function} onSend - Callback zum Senden des aktuellen Werts.
 * @param {number} [min=0] - Minimal zulässiger Wert.
 * @param {number} [max=100] - Maximal zulässiger Wert.
 * @param {number} [step=1] - Schrittweite des Schiebereglers.
 * @param {string} [unit="%"] - Einheit des angezeigten Werts.
 * @param {string} [accent="#06B6D4"] - Akzentfarbe der Regelung.
 * @param {boolean} busy - Gibt an, ob die Senden-Schaltfläche deaktiviert wird.
 * @param {string} testid - Präfix für die Test-IDs der Bedienelemente.
 */
function SliderControl({ label, value, onChange, onSend, min = 0, max = 100, step = 1, unit = "%", accent = "#06B6D4", busy, testid }) {
  const sliderValue = useMemo(() => [value], [value]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
        <span>{label}</span>
        <span className="text-white font-mono text-base normal-case tracking-normal">
          <span style={{ color: accent }} className="font-semibold">{value}</span>
          <span className="text-white/45 text-xs ml-1">{unit}</span>
        </span>
      </div>
      <Slider value={sliderValue} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={step} className="my-3" data-testid={`${testid}-slider`} />
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-white/40">{min}{unit} ─ {max}{unit}</div>
        <PrimaryButton onClick={onSend} disabled={busy} accent={accent} data-testid={`${testid}-send`}>
          <Send size={12} className="mr-1.5" /> Senden
        </PrimaryButton>
      </div>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex-1 h-px bg-white/10" />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

export default function Control() {
  const [limit, setLimit] = useState(100);
  const [truLimit, setTruLimit] = useState(300);
  const [truTarget, setTruTarget] = useState(15);
  const [truMin, setTruMin] = useState(0);
  const [truMax, setTruMax] = useState(800);
  const [hoyResult, setHoyResult] = useState(null);
  const [truResult, setTruResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const runHoy = async (action, value) => {
    setBusy(true); setHoyResult({ pending: true, action });
    try { setHoyResult(await controlHoymiles(action, value)); }
    catch (e) { setHoyResult({ ok: false, error: e?.response?.data?.detail || e.message }); }
    finally { setBusy(false); }
  };
  const runTru = async (action, value) => {
    setBusy(true); setTruResult({ pending: true, action });
    try { setTruResult(await controlTrucki(action, value)); }
    catch (e) { setTruResult({ ok: false, error: e?.response?.data?.detail || e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="control-page">
      <IntroCard title="Steuerung" subtitle="Hoymiles- & Trucki-Befehle, MQTT-Overrides, Settings-Editor" sections={INTRO_SECTIONS} accent="#F87171" testid="intro-control" />

      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
        <span className="w-1.5 h-7 rounded-sm" style={{ background: "#F87171", boxShadow: "0 0 10px #F8717188" }} />
        Steuerung
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hoymiles — kompakter */}
        <Panel title="Hoymiles HM1500 · Ahoy DTU" accent="#FACC15" testid="control-hoymiles">
          <SliderControl
            label="Power-Limit"
            value={limit}
            onChange={setLimit}
            onSend={() => runHoy("limit", limit)}
            min={0} max={100} step={1} unit="%" accent="#FACC15"
            busy={busy} testid="hoy-limit"
          />
          <Divider label="Aktionen" />
          <div className="grid grid-cols-3 gap-2">
            <NeoButton onClick={() => runHoy("power_on")} disabled={busy} data-testid="btn-hoy-on">
              <Power size={14} className="mr-1.5 text-emerald-300" /> ON
            </NeoButton>
            <NeoButton onClick={() => runHoy("power_off")} disabled={busy} data-testid="btn-hoy-off">
              <Power size={14} className="mr-1.5 text-red-300" /> OFF
            </NeoButton>
            <NeoButton onClick={() => runHoy("restart")} disabled={busy} data-testid="btn-hoy-restart">
              <RotateCw size={14} className="mr-1.5" /> Restart
            </NeoButton>
          </div>
          <Result res={hoyResult} />
        </Panel>

        {/* Trucki — UNIFIED: Steuerung + Settings */}
        <Panel title="Trucki2Shelly · Steuerung & Settings" accent="#06B6D4" testid="control-trucki">
          {/* Live AC-Setpoint */}
          <SliderControl
            label="AC-Setpoint (Einspeise-Leistung)"
            value={truLimit}
            onChange={setTruLimit}
            onSend={() => runTru("limit", truLimit)}
            min={0} max={2400} step={10} unit=" W" accent="#06B6D4"
            busy={busy} testid="tru-limit"
          />
          <Divider label="ZEPC & Restart" />
          <div className="grid grid-cols-3 gap-2">
            <NeoButton onClick={() => runTru("zepc_on")} disabled={busy} data-testid="btn-tru-zepc-on">
              <Power size={14} className="mr-1.5 text-emerald-300" /> ZEPC ON
            </NeoButton>
            <NeoButton onClick={() => runTru("zepc_off")} disabled={busy} data-testid="btn-tru-zepc-off">
              <Power size={14} className="mr-1.5 text-red-300" /> ZEPC OFF
            </NeoButton>
            <NeoButton onClick={() => runTru("restart")} disabled={busy} data-testid="btn-tru-restart">
              <RotateCw size={14} className="mr-1.5" /> Restart
            </NeoButton>
          </div>

          <Divider label="Settings · MQTT-Overrides" />
          <SliderControl
            label="TARGET (Netzbezug-Soll)"
            value={truTarget}
            onChange={setTruTarget}
            onSend={() => runTru("target", truTarget)}
            min={-200} max={500} step={5} unit=" W" accent="#A78BFA"
            busy={busy} testid="tru-target"
          />
          <SliderControl
            label="MIN-Power"
            value={truMin}
            onChange={setTruMin}
            onSend={() => runTru("min", truMin)}
            min={0} max={500} step={10} unit=" W" accent="#A78BFA"
            busy={busy} testid="tru-min"
          />
          <SliderControl
            label="MAX-Power"
            value={truMax}
            onChange={setTruMax}
            onSend={() => runTru("max", truMax)}
            min={0} max={2400} step={10} unit=" W" accent="#A78BFA"
            busy={busy} testid="tru-max"
          />
          <Result res={truResult} />
        </Panel>
      </div>
    </div>
  );
}
