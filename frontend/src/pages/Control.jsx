import { useState } from "react";
import { controlHoymiles, controlTrucki } from "../lib/api";
import IntroCard from "../components/IntroCard";
import { Power, Play, Square, RotateCw, Send } from "lucide-react";

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Direkte Befehle an den Hoymiles HM1500 (via Ahoy DTU /api/ctrl) und den Trucki-Speicher (HTTP-Endpunkte). Jeder Befehl wird einmalig gesendet und das Roh-JSON/Text-Response unter dem jeweiligen Panel angezeigt.",
  },
  {
    label: "Hoymiles · Parameter",
    body: <span><b>Limit (%)</b>: 0–100, nicht-persistent · <b>Power ON/OFF</b>: schaltet WR an/aus · <b>Start/Stop</b>: synonym · <b>Restart</b>: WR-Neustart (Verbindungsabbruch ~30 s). Endpoint: <code className="text-cyan-300">POST /api/control/hoymiles</code> {"{action, value}"}.</span>,
  },
  {
    label: "Trucki · Parameter",
    body: <span><b>Limit (W)</b>: Ziel-Einspeise-Leistung (0–MAX). Endpoint: <code className="text-cyan-300">GET http://{`<trucki-ip>`}/Limit?L=&lt;watt&gt;</code> · <b>ZEPC ON/OFF</b>: Zero-Export-Power-Controller · <b>Restart</b>.</span>,
  },
  {
    label: "Rückgabewerte",
    body: <span>Antwort als JSON: <code className="text-cyan-300">{"{ok:true|false, response:…}"}</code> · im Demo-Modus zusätzlich <code className="text-cyan-300">demo:true</code>. Sichtbar unter jedem Panel als JSON-Block.</span>,
  },
  {
    label: "Beispiele",
    body: <span>‚Power-Limit 60 %' an Hoymiles drosselt sofort die AC-Ausgabe. ‚Trucki-Limit 200 W' begrenzt die Einspeisung. ‚Restart' eignet sich bei MQTT-Verbindungsstörungen.</span>,
  },
  {
    label: "Mögliche Fehler",
    body: "HTTP 502 = Gerät nicht erreichbar (IP-Adresse / Stromzufuhr prüfen). HTTP 400 = ungültige Aktion. Im Demo-Modus geben alle Befehle eine simulierte Erfolgs-Antwort zurück und es passiert physikalisch nichts.",
  },
  {
    label: "Einschränkungen",
    body: "Hoymiles-Limit ist nicht-persistent — nach WR-Reboot ist es wieder 100 %. Für persistente Werte über Ahoy-DTU-Web-UI ‚limit_persistent_absolute' nutzen.",
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

function NeoButton({ children, ...props }) {
  return (
    <button {...props} className={`btn-neo px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ""}`}>
      {children}
    </button>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button {...props} className={`px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50 ${props.className || ""}`}
      style={{ background: "linear-gradient(180deg, #67e8f9, #06B6D4)", boxShadow: "0 0 12px rgba(6,182,212,0.45)" }}>
      {children}
    </button>
  );
}

export default function Control() {
  const [limit, setLimit] = useState(100);
  const [truLimit, setTruLimit] = useState(800);
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
      <IntroCard title="Steuerung" subtitle="Direkte Hoymiles- und Trucki-Befehle" sections={INTRO_SECTIONS} accent="#F87171" testid="intro-control" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
          <span className="w-1.5 h-7 rounded-sm" style={{ background: "#F87171", boxShadow: "0 0 10px #F8717188" }} />
          Steuerung
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Hoymiles HM1500 · Ahoy DTU" accent="#FACC15" testid="control-hoymiles">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Power-Limit (%)</label>
            <div className="flex gap-2 mt-2">
              <input type="number" min="0" max="100" value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                     className="glass-input flex-1 px-3 py-2 font-mono text-sm" data-testid="input-hoy-limit" />
              <PrimaryButton onClick={() => runHoy("limit", limit)} disabled={busy} data-testid="btn-hoy-limit">
                <Send size={14} className="mr-1.5" /> Senden
              </PrimaryButton>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NeoButton onClick={() => runHoy("power_on")} disabled={busy} data-testid="btn-hoy-on">
              <Power size={14} className="mr-1.5 text-emerald-300" /> Power ON
            </NeoButton>
            <NeoButton onClick={() => runHoy("power_off")} disabled={busy} data-testid="btn-hoy-off">
              <Power size={14} className="mr-1.5 text-red-300" /> Power OFF
            </NeoButton>
            <NeoButton onClick={() => runHoy("start")} disabled={busy} data-testid="btn-hoy-start">
              <Play size={14} className="mr-1.5" /> Start
            </NeoButton>
            <NeoButton onClick={() => runHoy("stop")} disabled={busy} data-testid="btn-hoy-stop">
              <Square size={14} className="mr-1.5" /> Stop
            </NeoButton>
            <NeoButton onClick={() => runHoy("restart")} disabled={busy} data-testid="btn-hoy-restart" className="col-span-2">
              <RotateCw size={14} className="mr-1.5" /> Restart
            </NeoButton>
          </div>
          <Result res={hoyResult} />
        </Panel>

        <Panel title="Trucki2Shelly Gateway" accent="#06B6D4" testid="control-trucki">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Power-Limit (W)</label>
            <div className="flex gap-2 mt-2">
              <input type="number" min="0" max="2400" step="10" value={truLimit} onChange={(e) => setTruLimit(Number(e.target.value))}
                     className="glass-input flex-1 px-3 py-2 font-mono text-sm" data-testid="input-tru-limit" />
              <PrimaryButton onClick={() => runTru("limit", truLimit)} disabled={busy} data-testid="btn-tru-limit">
                <Send size={14} className="mr-1.5" /> Senden
              </PrimaryButton>
            </div>
            <div className="font-mono text-[10px] text-white/45 mt-1.5">
              Begrenzt die AC-Ausgangsleistung in Watt (Trucki HTTP <code>/Limit?L=…</code>).
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NeoButton onClick={() => runTru("zepc_on")} disabled={busy} data-testid="btn-tru-zepc-on">ZEPC ON</NeoButton>
            <NeoButton onClick={() => runTru("zepc_off")} disabled={busy} data-testid="btn-tru-zepc-off">ZEPC OFF</NeoButton>
            <NeoButton onClick={() => runTru("restart")} disabled={busy} data-testid="btn-tru-restart" className="col-span-2">
              <RotateCw size={14} className="mr-1.5" /> Restart
            </NeoButton>
          </div>
          <Result res={truResult} />
        </Panel>
      </div>
    </div>
  );
}
