import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import IntroCard from "../components/IntroCard";
import { Check, X, Minus, PlayCircle, RefreshCw, ChevronRight } from "lucide-react";

const runTests = () => api.post("/diagnostics/run", {}).then((r) => r.data);
const getRaw = () => api.get("/diagnostics/raw").then((r) => r.data);

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Tiefenanalyse des Backend-Zustands inklusive Selbst-Test für jeden Integrations-Endpunkt und alle vier Geräte. Zeigt außerdem die rohen MQTT-Feldwerte je Gerät, gefiltert nach Topic-Präfix.",
  },
  {
    label: "Selbst-Test · Checks",
    body: <span><b>9 Checks</b>: Backend-API, MongoDB (Ping + Snapshot-Count), Snapshot-Poller, MQTT (Verbindung + Nachrichten-Zähler), InfluxDB (Verbindung + Writes), 4 Geräte (MQTT-Freshness {"< 90 s"} oder HTTP-Ping mit 1.5s-Timeout).</span>,
  },
  {
    label: "Status-Werte",
    body: <span><span className="text-emerald-300 font-medium">PASS</span> = ok&nbsp;|&nbsp;<span className="text-red-300 font-medium">FAIL</span> = nicht ok&nbsp;|&nbsp;<span className="text-white/55 font-medium">SKIP</span> = nicht anwendbar (z.&nbsp;B. Integration deaktiviert oder Demo-Modus aktiv).</span>,
  },
  {
    label: "Endpoints",
    body: <span><code className="text-cyan-300">POST /api/diagnostics/run</code> liefert {"{ summary, tests:[{name, ok, detail, ms}] }"} · <code className="text-cyan-300">GET /api/diagnostics/raw</code> liefert pro Gerät die MQTT-Roh-Felder.</span>,
  },
  {
    label: "Beispiele",
    body: "Nach Setup-Änderungen den Selbst-Test starten — alle Checks sollten grün sein. Wenn ein Gerät FAIL zeigt: IP unter Geräte prüfen oder direkten Ping vom Server testen.",
  },
  {
    label: "Mögliche Fehler",
    body: "FAIL auf MQTT: Broker-Adresse/Auth falsch → siehe last_error · FAIL auf einem Gerät: IP nicht erreichbar oder Service down · FAIL auf MongoDB: Service stopped (sehr selten, nur bei Container-Problem).",
  },
];

function getResultIcon(ok)      { if (ok === true) return Check; if (ok === false) return X; return Minus; }
function getResultClass(ok) {
  if (ok === true)  return "border-l-emerald-400/70 bg-emerald-400/[0.04]";
  if (ok === false) return "border-l-red-400/70 bg-red-400/[0.04]";
  return "border-l-white/20 bg-white/[0.02]";
}
function getResultIconClass(ok) {
  if (ok === true) return "text-emerald-300";
  if (ok === false) return "text-red-300";
  return "text-white/40";
}
function formatFieldValue(v) {
  if (v === null || v === undefined) return "–";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ResultRow({ name, ok, detail, ms }) {
  const Icon = getResultIcon(ok);
  return (
    <div className={`flex items-center gap-3 glass border-l-[6px] ${getResultClass(ok)} px-3 py-2.5`}
         data-testid={`diag-${name.replace(/\s+/g, "-").toLowerCase()}`}>
      <Icon size={16} strokeWidth={3} className={getResultIconClass(ok)} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-white">{name}</div>
        <div className="font-mono text-[11px] text-white/55 truncate">{detail}</div>
      </div>
      {ms !== null && ms !== undefined && (
        <div className="font-mono text-[10px] text-white/40 whitespace-nowrap">{ms} ms</div>
      )}
    </div>
  );
}

function FieldTable({ obj, testid }) {
  const entries = Object.entries(obj || {}).filter(([k]) => !k.startsWith("_"));
  if (!entries.length) return <div className="font-mono text-xs text-white/40 italic">Noch keine Daten empfangen.</div>;
  return (
    <table className="w-full font-mono text-xs" data-testid={testid}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-white/5 last:border-b-0">
            <td className="py-1 pr-3 text-white/55 w-1/2 truncate">{k}</td>
            <td className="py-1 text-white/85 break-all">{formatFieldValue(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeviceBlock({ title, accent, ts, children }) {
  return (
    <div className="glass" style={{ borderLeft: `3px solid ${accent}`, boxShadow: `0 0 24px -16px ${accent}aa` }}>
      <div className="border-b border-white/10 px-4 py-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">{title}</div>
        <div className="font-mono text-[10px] text-white/40">
          {ts ? `MQTT · ${new Date(ts).toLocaleTimeString("de-DE")}` : "keine MQTT-Daten"}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function Diagnose() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [raw, setRaw] = useState(null);

  const reloadRaw = useCallback(() => { getRaw().then(setRaw).catch(() => {}); }, []);

  useEffect(() => {
    reloadRaw();
    const id = setInterval(reloadRaw, 5000);
    return () => clearInterval(id);
  }, [reloadRaw]);

  const run = async () => {
    setRunning(true);
    try { setResult(await runTests()); reloadRaw(); }
    finally { setRunning(false); }
  };

  return (
    <div className="space-y-6" data-testid="diagnose-page">
      <IntroCard title="Diagnose" subtitle="Selbst-Test aller Integrationen + Roh-MQTT-Geräteanzeige" sections={INTRO_SECTIONS} accent="#A78BFA" testid="intro-diagnose" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
          <span className="w-1.5 h-7 rounded-sm" style={{ background: "#A78BFA", boxShadow: "0 0 10px #A78BFA88" }} />
          Diagnose
        </h1>
        <button onClick={run} disabled={running} data-testid="btn-run-tests"
          className="px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] rounded text-slate-900 font-semibold disabled:opacity-50 inline-flex items-center"
          style={{ background: "linear-gradient(180deg, #c4b5fd, #A78BFA)", boxShadow: "0 0 14px rgba(167,139,250,0.45)" }}>
          {running ? (
            <><RefreshCw size={14} className="mr-1.5 animate-spin" /> Läuft...</>
          ) : (
            <><PlayCircle size={14} className="mr-1.5" /> Selbst-Test starten</>
          )}
        </button>
      </div>

      <div className="glass">
        <div className="border-b border-white/10 px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">Selbst-Test</div>
          {result && (
            <div className="flex gap-3 font-mono text-[10px]" data-testid="test-summary">
              <span className="text-emerald-300">PASS {result.summary.pass}</span>
              <span className="text-red-300">FAIL {result.summary.fail}</span>
              <span className="text-white/45">SKIP {result.summary.skip}</span>
              <span className="text-white/30">·</span>
              <span className="text-white/55">{result.duration_ms} ms</span>
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          {!result && (
            <div className="font-mono text-sm text-white/55 flex items-center gap-2">
              <ChevronRight size={14} /> Klicke „Selbst-Test starten" um alle Komponenten zu prüfen.
            </div>
          )}
          {result?.tests?.map((t, i) => <ResultRow key={i} {...t} />)}
        </div>
      </div>

      <div className="pb-2 border-b border-white/10">
        <h2 className="text-lg font-semibold tracking-tight text-white">Geräte-Details (MQTT-Rohdaten)</h2>
        <div className="font-mono text-xs text-white/55 mt-0.5">Live-Werte direkt aus dem MQTT-Stream · Auto-Refresh 5 s</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeviceBlock title="Shelly Pro 3EM" accent="#F87171" ts={raw?.shelly?._ts}>
          <div className="space-y-2">
            <div className="font-mono text-xs text-white/55">
              Total: <span className="text-white">{raw?.shelly?.total_power ?? "–"} W</span> ·
              Online: <span className="text-white">{String(raw?.shelly?.online ?? false)}</span>
            </div>
            {raw?.shelly?.phases?.length > 0 ? (
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.22em] text-white/55">
                    <th className="text-left py-1">Ph</th>
                    <th className="text-right py-1">P (W)</th>
                    <th className="text-right py-1">U (V)</th>
                    <th className="text-right py-1">I (A)</th>
                    <th className="text-right py-1">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {raw.shelly.phases.map((p) => (
                    <tr key={p.phase} className="border-b border-white/5 text-white/85">
                      <td className="py-1">{p.phase}</td>
                      <td className="py-1 text-right">{p.power}</td>
                      <td className="py-1 text-right">{p.voltage}</td>
                      <td className="py-1 text-right">{p.current}</td>
                      <td className="py-1 text-right">{p.pf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="font-mono text-xs text-white/40 italic">Noch keine Daten empfangen.</div>
            )}
          </div>
        </DeviceBlock>

        <DeviceBlock title="Ahoy DTU · Hoymiles HM1500" accent="#FACC15" ts={raw?.ahoy?._ts}>
          <FieldTable obj={raw?.ahoy?.raw} testid="raw-ahoy" />
        </DeviceBlock>

        <DeviceBlock title="Trucki2Shelly Gateway" accent="#06B6D4" ts={raw?.trucki?._ts}>
          <FieldTable obj={raw?.trucki?.raw} testid="raw-trucki" />
        </DeviceBlock>

        <DeviceBlock title="Victron VenusOS · System" accent="#34D399" ts={raw?.victron?._ts}>
          <FieldTable obj={raw?.victron?.system} testid="raw-victron-system" />
          {raw?.victron?.grid && Object.keys(raw.victron.grid).length > 0 && (
            <>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mt-3 mb-1">
                Grid (Shelly via VenusOS)
              </div>
              <FieldTable obj={raw.victron.grid} testid="raw-victron-grid" />
            </>
          )}
        </DeviceBlock>

        {raw?.victron?.instances && Object.entries(raw.victron.instances).map(([inst, fields]) => (
          <DeviceBlock key={inst} title={`Victron MPPT · Instance ${inst}`} accent="#34D399" ts={fields._ts}>
            <FieldTable obj={fields} testid={`raw-victron-${inst}`} />
          </DeviceBlock>
        ))}
      </div>
    </div>
  );
}
