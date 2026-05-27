import { useState } from "react";
import { controlHoymiles, controlTrucki } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Power, Play, Square, RotateCw, Send } from "lucide-react";

function Result({ res }) {
  if (!res) return null;
  return (
    <pre className="mt-2 p-2 border border-black bg-gray-50 font-mono text-[11px] overflow-x-auto" data-testid="control-result">
      {JSON.stringify(res, null, 2)}
    </pre>
  );
}

export default function Control() {
  const [limit, setLimit] = useState(100);
  const [truLimit, setTruLimit] = useState(800);
  const [hoyResult, setHoyResult] = useState(null);
  const [truResult, setTruResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const runHoy = async (action, value) => {
    setBusy(true);
    setHoyResult({ pending: true, action });
    try {
      const r = await controlHoymiles(action, value);
      setHoyResult(r);
    } catch (e) {
      setHoyResult({ ok: false, error: e?.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };
  const runTru = async (action, value) => {
    setBusy(true);
    setTruResult({ pending: true, action });
    try {
      const r = await controlTrucki(action, value);
      setTruResult(r);
    } catch (e) {
      setTruResult({ ok: false, error: e?.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  const btn = "rounded-none border border-black bg-white text-black hover:bg-black hover:text-white font-mono text-xs uppercase tracking-[0.15em]";
  const primary = "rounded-none bg-black text-white hover:bg-gray-800 font-mono text-xs uppercase tracking-[0.15em]";

  return (
    <div className="space-y-6" data-testid="control-page">
      <div className="border-b border-black pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Steuerung</h1>
        <div className="font-mono text-xs text-gray-600 mt-1">
          Direkt-Befehle an Hoymiles (Ahoy DTU) und Trucki Gateway. Im Demo-Modus werden Befehle simuliert.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hoymiles */}
        <div className="border border-black bg-white" data-testid="control-hoymiles">
          <div className="border-b border-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">
            Hoymiles HM1500 · Ahoy DTU
          </div>
          <div className="p-4 space-y-4">
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Power-Limit (%)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="rounded-none border-black font-mono"
                  data-testid="input-hoy-limit"
                />
                <Button onClick={() => runHoy("limit", limit)} disabled={busy} className={primary} data-testid="btn-hoy-limit">
                  <Send size={14} className="mr-1.5" /> Senden
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => runHoy("power_on")} disabled={busy} className={btn} data-testid="btn-hoy-on">
                <Power size={14} className="mr-1.5" /> Power ON
              </Button>
              <Button onClick={() => runHoy("power_off")} disabled={busy} className={btn} data-testid="btn-hoy-off">
                <Power size={14} className="mr-1.5" /> Power OFF
              </Button>
              <Button onClick={() => runHoy("start")} disabled={busy} className={btn} data-testid="btn-hoy-start">
                <Play size={14} className="mr-1.5" /> Start
              </Button>
              <Button onClick={() => runHoy("stop")} disabled={busy} className={btn} data-testid="btn-hoy-stop">
                <Square size={14} className="mr-1.5" /> Stop
              </Button>
              <Button onClick={() => runHoy("restart")} disabled={busy} className={`${btn} col-span-2`} data-testid="btn-hoy-restart">
                <RotateCw size={14} className="mr-1.5" /> Restart
              </Button>
            </div>
            <Result res={hoyResult} />
          </div>
        </div>

        {/* Trucki */}
        <div className="border border-black bg-white" data-testid="control-trucki">
          <div className="border-b border-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">
            Trucki2Shelly Gateway
          </div>
          <div className="p-4 space-y-4">
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">Power-Limit (W)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  min="0"
                  max="2400"
                  step="10"
                  value={truLimit}
                  onChange={(e) => setTruLimit(Number(e.target.value))}
                  className="rounded-none border-black font-mono"
                  data-testid="input-tru-limit"
                />
                <Button onClick={() => runTru("limit", truLimit)} disabled={busy} className={primary} data-testid="btn-tru-limit">
                  <Send size={14} className="mr-1.5" /> Senden
                </Button>
              </div>
              <div className="font-mono text-[10px] text-gray-500 mt-1">
                Begrenzt die AC-Ausgangsleistung in Watt (Trucki HTTP /Limit?L=…).
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => runTru("zepc_on")} disabled={busy} className={btn} data-testid="btn-tru-zepc-on">
                ZEPC ON
              </Button>
              <Button onClick={() => runTru("zepc_off")} disabled={busy} className={btn} data-testid="btn-tru-zepc-off">
                ZEPC OFF
              </Button>
              <Button onClick={() => runTru("restart")} disabled={busy} className={`${btn} col-span-2`} data-testid="btn-tru-restart">
                <RotateCw size={14} className="mr-1.5" /> Restart
              </Button>
            </div>
            <Result res={truResult} />
          </div>
        </div>
      </div>
    </div>
  );
}
