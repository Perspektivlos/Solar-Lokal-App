import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Check, X, Minus, PlayCircle, RefreshCw, ChevronRight } from "lucide-react";

const runTests = () => api.post("/diagnostics/run", {}).then((r) => r.data);
const getRaw = () => api.get("/diagnostics/raw").then((r) => r.data);

function getResultIcon(ok) {
  if (ok === true) return Check;
  if (ok === false) return X;
  return Minus;
}

function getResultClass(ok) {
  if (ok === true) return "border-l-[#22C55E] bg-green-50/40";
  if (ok === false) return "border-l-[#EF4444] bg-red-50/40";
  return "border-l-gray-400 bg-gray-50/40";
}

function getResultIconClass(ok) {
  if (ok === true) return "text-[#22C55E]";
  if (ok === false) return "text-[#EF4444]";
  return "text-gray-500";
}

function formatFieldValue(v) {
  if (v === null || v === undefined) return "–";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ResultRow({ name, ok, detail, ms }) {
  const Icon = getResultIcon(ok);
  return (
    <div
      className={`flex items-center gap-3 border border-black border-l-[6px] ${getResultClass(ok)} px-3 py-2`}
      data-testid={`diag-${name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <Icon size={16} strokeWidth={3} className={getResultIconClass(ok)} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{name}</div>
        <div className="font-mono text-[11px] text-gray-600 truncate">{detail}</div>
      </div>
      {ms !== null && ms !== undefined && (
        <div className="font-mono text-[10px] text-gray-500 whitespace-nowrap">{ms} ms</div>
      )}
    </div>
  );
}

function FieldTable({ obj, testid }) {
  const entries = Object.entries(obj || {}).filter(([k]) => !k.startsWith("_"));
  if (!entries.length) {
    return <div className="font-mono text-xs text-gray-500 italic">Noch keine Daten empfangen.</div>;
  }
  return (
    <table className="w-full font-mono text-xs" data-testid={testid}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-gray-200 last:border-b-0">
            <td className="py-1 pr-3 text-gray-600 w-1/2 truncate">{k}</td>
            <td className="py-1 text-black break-all">{formatFieldValue(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeviceCard({ title, accent, ts, children }) {
  return (
    <div className="border border-black bg-white">
      <div
        className="border-b border-black px-4 py-2 flex items-center justify-between"
        style={{ borderLeft: `6px solid ${accent}` }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">{title}</div>
        <div className="font-mono text-[10px] text-gray-500">
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

  const reloadRaw = useCallback(() => {
    getRaw().then(setRaw).catch(() => {});
  }, []);

  useEffect(() => {
    reloadRaw();
    const id = setInterval(reloadRaw, 5000);
    return () => clearInterval(id);
  }, [reloadRaw]);

  const run = async () => {
    setRunning(true);
    try {
      const r = await runTests();
      setResult(r);
      reloadRaw();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="diagnose-page">
      <div className="flex items-center justify-between border-b border-black pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Diagnose</h1>
          <div className="font-mono text-xs text-gray-600 mt-1">
            Tiefenanalyse aller Geräte · Selbst-Test für Erreichbarkeit & Integrationen
          </div>
        </div>
        <Button
          onClick={run}
          disabled={running}
          className="rounded-none bg-black text-white hover:bg-gray-800 font-mono text-xs uppercase tracking-[0.15em]"
          data-testid="btn-run-tests"
        >
          {running ? (
            <>
              <RefreshCw size={14} className="mr-1.5 animate-spin" /> Läuft...
            </>
          ) : (
            <>
              <PlayCircle size={14} className="mr-1.5" /> Selbst-Test starten
            </>
          )}
        </Button>
      </div>

      {/* Test Results */}
      <div className="border border-black bg-white">
        <div className="border-b border-black px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Selbst-Test</div>
          {result && (
            <div className="flex gap-3 font-mono text-[10px]" data-testid="test-summary">
              <span className="text-[#22C55E]">PASS {result.summary.pass}</span>
              <span className="text-[#EF4444]">FAIL {result.summary.fail}</span>
              <span className="text-gray-500">SKIP {result.summary.skip}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-600">{result.duration_ms} ms</span>
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          {!result && (
            <div className="font-mono text-sm text-gray-600 flex items-center gap-2">
              <ChevronRight size={14} /> Klicke „Selbst-Test starten" um Backend, MongoDB, MQTT,
              InfluxDB und alle Geräte zu prüfen.
            </div>
          )}
          {result?.tests?.map((t, i) => (
            <ResultRow key={i} {...t} />
          ))}
        </div>
      </div>

      {/* Raw Device Data */}
      <div className="border-b border-black pb-2">
        <h2 className="text-lg font-semibold tracking-tight">Geräte-Details (MQTT-Rohdaten)</h2>
        <div className="font-mono text-xs text-gray-600 mt-0.5">
          Live-Werte direkt aus dem MQTT-Stream (Aktualisierung alle 5 s)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeviceCard title="Shelly Pro 3EM" accent="#EF4444" ts={raw?.shelly?._ts}>
          <div className="space-y-2">
            <div className="font-mono text-xs text-gray-600">
              Total: <span className="text-black">{raw?.shelly?.total_power ?? "–"} W</span> ·
              Online: <span className="text-black">{String(raw?.shelly?.online ?? false)}</span>
            </div>
            {raw?.shelly?.phases?.length > 0 ? (
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-black text-[10px] uppercase tracking-[0.2em] text-gray-600">
                    <th className="text-left py-1">Ph</th>
                    <th className="text-right py-1">P (W)</th>
                    <th className="text-right py-1">U (V)</th>
                    <th className="text-right py-1">I (A)</th>
                    <th className="text-right py-1">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {raw.shelly.phases.map((p) => (
                    <tr key={p.phase} className="border-b border-gray-200">
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
              <div className="font-mono text-xs text-gray-500 italic">Noch keine Daten empfangen.</div>
            )}
          </div>
        </DeviceCard>

        <DeviceCard title="Ahoy DTU · Hoymiles HM1500" accent="#EAB308" ts={raw?.ahoy?._ts}>
          <FieldTable obj={raw?.ahoy?.raw} testid="raw-ahoy" />
        </DeviceCard>

        <DeviceCard title="Trucki2Shelly Gateway" accent="#3B82F6" ts={raw?.trucki?._ts}>
          <FieldTable obj={raw?.trucki?.raw} testid="raw-trucki" />
        </DeviceCard>

        <DeviceCard title="Victron VenusOS · System" accent="#10B981" ts={raw?.victron?._ts}>
          <FieldTable obj={raw?.victron?.system} testid="raw-victron-system" />
          {raw?.victron?.grid && Object.keys(raw.victron.grid).length > 0 && (
            <>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600 mt-3 mb-1">
                Grid (Shelly via VenusOS)
              </div>
              <FieldTable obj={raw.victron.grid} testid="raw-victron-grid" />
            </>
          )}
        </DeviceCard>

        {raw?.victron?.instances && Object.entries(raw.victron.instances).map(([inst, fields]) => (
          <DeviceCard
            key={inst}
            title={`Victron MPPT · Instance ${inst}`}
            accent="#10B981"
            ts={fields._ts}
          >
            <FieldTable obj={fields} testid={`raw-victron-${inst}`} />
          </DeviceCard>
        ))}
      </div>
    </div>
  );
}
