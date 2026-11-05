import { useCallback, useEffect, useState } from "react";
import { Activity, Cpu, Gauge, Stethoscope } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { getSmartShuntPreview } from "../lib/api";
import { PreviewHeader } from "../components/smartshunt/PreviewHeader";
import { OverviewPanel } from "../components/smartshunt/OverviewPanel";
import { DevicePanel } from "../components/smartshunt/DevicePanel";
import { DiagnosticsPanel } from "../components/smartshunt/DiagnosticsPanel";
import { HistoryPanel } from "../components/smartshunt/HistoryPanel";

const views = [
  ["overview", "Übersicht", Gauge],
  ["device", "Gerät", Cpu],
  ["diagnostics", "Diagnose", Stethoscope],
  ["history", "Verlauf", Activity],
];

export default function SmartShuntPreview() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState(() => localStorage.getItem("smartshunt.preview.tab") || "overview");
  const load = useCallback(async () => {
    setRefreshing(true);
    try { setPayload(await getSmartShuntPreview()); setError(""); }
    catch { setError("SmartShunt-Vorschau konnte nicht geladen werden."); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const changeTab = (value) => { setTab(value); localStorage.setItem("smartshunt.preview.tab", value); };
  return (
    <div className="min-h-screen text-white page-reveal" data-testid="smartshunt-preview-page">
      <PreviewHeader payload={payload} refreshing={refreshing} onRefresh={load} />
      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {error && <div role="alert" className="glass border-l-[3px] border-l-red-400 px-4 py-3 text-sm text-red-200 mb-5" data-testid="smartshunt-preview-error">{error}</div>}
        {!payload ? (
          <div className="glass min-h-[320px] grid place-items-center font-mono text-sm text-white/45" data-testid="smartshunt-preview-loading">SmartShunt-Daten werden geladen…</div>
        ) : (
          <Tabs value={tab} onValueChange={changeTab} data-testid="smartshunt-tabs">
            <TabsList className="w-full h-auto grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-white/10 bg-[#070c18] p-1.5" data-testid="smartshunt-tab-list">
              {views.map(([id, label, Icon]) => (
                <TabsTrigger key={id} value={id} data-testid={`smartshunt-tab-${id}`} className="h-10 gap-2 rounded-md font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 data-[state=active]:bg-cyan-400/12 data-[state=active]:text-cyan-200 data-[state=active]:shadow-none"><Icon size={13} /> {label}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview" className="mt-5"><OverviewPanel payload={payload} /></TabsContent>
            <TabsContent value="device" className="mt-5"><DevicePanel payload={payload} /></TabsContent>
            <TabsContent value="diagnostics" className="mt-5"><DiagnosticsPanel payload={payload} /></TabsContent>
            <TabsContent value="history" className="mt-5"><HistoryPanel current={payload.current} /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}