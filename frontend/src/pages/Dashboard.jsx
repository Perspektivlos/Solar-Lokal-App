import { useEffect, useRef, useState } from "react";
import { getLive, getToday, getHistory } from "../lib/api";
import EnergyFlow from "../components/EnergyFlow";
import IntroCard from "../components/IntroCard";
import RoundTripCard from "../components/RoundTripCard";
import PhaseBalance from "../components/PhaseBalance";
import MpptCompare from "../components/MpptCompare";
import KpiStrip from "../components/KpiStrip";
import GridHouseCard from "../components/GridHouseCard";
import TruckiCard from "../components/TruckiCard";
import VictronCard from "../components/VictronCard";
import { COLOR, formatNum, relativeTime, GlassCard, SourceBadge, Badge, Delta, MetricBig, Stat, SectionHeader } from "../components/solar-ui";
import { Cable, AlertTriangle, Activity, Sun, BatteryCharging } from "lucide-react";

const INTRO_SECTIONS = [
  {
    label: "Zweck & Funktion",
    body: "Zentraler Live-Überblick aller vier Geräte (Shelly Pro 3EM, Hoymiles via Ahoy DTU, Trucki-Speicher, 2× Victron MPPT). Zeigt aktuellen Energiefluss, 3-Phasen-Verteilung, Akku-SoC und Tageswerte.",
  },
  {
    label: "Datenquellen",
    body: "Im Demo-Modus werden Mock-Werte erzeugt. Live: MQTT-Stream wird bevorzugt; falls keine Nachrichten in 90s, fällt das Backend auf direkten HTTP-Aufruf (Shelly /rpc, Ahoy /api, Trucki /status) zurück.",
  },
  {
    label: "Aktualisierung",
    body: "Frontend pollt /api/live + /api/today alle 3 Sekunden. Die Sparkline-Trendlinien zeigen ein gleitendes 15-Minuten-Fenster (beim Laden aus der History vorbefüllt). Tageswerte aus Trapez-Integration seit Mitternacht (UTC).",
  },
  {
    label: "Layout-Gruppen",
    body: "Oben: KPI-Leiste (Gesamt + Aktuell) und Energiefluss. Danach thematische Sektionen: Batterie · Victron · PV & Netz · Shelly.",
  },
  {
    label: "Bekannte Einschränkungen",
    body: "Trucki-SoC wird aus VBAT linear geschätzt (LiFePO4 16S). House-Power wird rechnerisch ermittelt — kann bei Mess-Latenz kurzzeitig unrealistisch wirken.",
  },
  {
    label: "Mögliche Fehler",
    body: "‚Fehler beim Laden' → Backend nicht erreichbar (Service-Status prüfen). Permanenter ‚FALLBACK'-Badge → MQTT enabled aber kein Stream + Gerät via HTTP nicht erreichbar.",
  },
];

function batteryStateKind(socDanger, power) {
  if (socDanger) return "KRITISCH";
  if (power > 20) return "LADEN";
  if (power < -20) return "ENTLADEN";
  return "NORMAL";
}

// Sparkline-Trail: Zeitreihen in Wertelisten je Kanal umwandeln.
function buildTrail(samples) {
  return {
    pv: samples.map((s) => s.pv),
    grid: samples.map((s) => s.grid),
    house: samples.map((s) => s.house),
    battery: samples.map((s) => s.battery),
  };
}

export default function Dashboard() {
  const [live, setLive] = useState(null);
  const [today, setToday] = useState(null);
  const [trail, setTrail] = useState({ pv: [], grid: [], house: [], battery: [] });
  const trailRef = useRef([]);
  const [err, setErr] = useState(null);
  const [prevLive, setPrevLive] = useState(null);
  const liveRef = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  // Gleitendes 15-Minuten-Fenster für die Sparklines (im Komponenten-Scope,
  // damit der Wert in den Effect-Closures immer definiert ist).
  const TRAIL_WINDOW_MS = 15 * 60 * 1000;

  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1000), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    let seeded = false;
    const tick = async () => {
      try {
        if (!seeded) {
          seeded = true;
          const h = await getHistory("1h");
          if (alive && h?.points) {
            const cutoff = Date.now() - TRAIL_WINDOW_MS;
            const samples = h.points
              .map((p) => ({ t: new Date(p.ts).getTime(), pv: p.pv_power, grid: p.grid_power, house: p.house_power, battery: p.battery_power }))
              .filter((s) => s.t >= cutoff);
            trailRef.current = samples;
            setTrail(buildTrail(samples));
          }
        }
        const [l, t] = await Promise.all([getLive(), getToday()]);
        if (!alive) return;
        setPrevLive(liveRef.current);
        liveRef.current = l;
        setLive(l);
        setToday(t);
        const cutoff = Date.now() - TRAIL_WINDOW_MS;
        const samples = [
          ...trailRef.current,
          { t: Date.now(), pv: l.summary.pv_power, grid: l.summary.grid_power, house: l.summary.house_power, battery: l.summary.battery_power },
        ].filter((s) => s.t >= cutoff);
        trailRef.current = samples;
        setTrail(buildTrail(samples));
        setErr(null);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (err) {
    return (
      <div className="space-y-6">
        <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent="#FACC15" testid="intro-dashboard" />
        <div className="glass-strong p-6" style={{ borderLeft: "3px solid #F87171" }} data-testid="dashboard-error">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle size={18} />
            <span className="font-mono text-sm">Fehler beim Laden: {err}</span>
          </div>
        </div>
      </div>
    );
  }
  if (!live) {
    return (
      <div className="space-y-6">
        <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent="#FACC15" testid="intro-dashboard" />
        <div className="font-mono text-sm text-white/55 flex items-center gap-2" data-testid="dashboard-loading">
          <Activity size={14} className="animate-pulse" />
          Lade Live-Daten…
        </div>
      </div>
    );
  }

  const { shelly, ahoy, trucki, victron, summary, demo_mode, timestamp } = live;
  const prev = prevLive;
  const socDanger = trucki?.soc !== undefined && trucki.soc < 15;
  const batteryKind = batteryStateKind(socDanger, summary.battery_power);

  return (
    <div className="space-y-6" data-testid="dashboard">
      <IntroCard title="Dashboard" subtitle="Live-Überblick aller Anlagen in einem Blick" sections={INTRO_SECTIONS} accent="#FACC15" testid="intro-dashboard" />

      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-white">
            <span className="w-1.5 h-7 rounded-sm" style={{ background: COLOR.pv, boxShadow: `0 0 10px ${COLOR.pv}aa` }} />
            Solar · Live
          </h1>
          <div className="font-mono text-[11px] text-white/60 mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse text-emerald-400" />
            Update: {relativeTime(timestamp, now)}
            <span className="text-white/30">·</span>
            <span>Uhr: {new Date(now).toLocaleTimeString("de-DE")}</span>
          </div>
        </div>
        {demo_mode && (
          <div className="border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] rounded" data-testid="demo-banner">
            ⚠ Demo-Modus aktiv · Werte werden simuliert
          </div>
        )}
      </div>

      {/* ÜBERSICHT · KPI-Leiste + Energiefluss */}
      <div data-testid="row-overview" className="space-y-6">
        <KpiStrip today={today} summary={summary} trail={trail} />
        <EnergyFlow summary={summary} trucki={trucki} />
      </div>

      {/* SEKTION · BATTERIE */}
      <div className="space-y-3">
        <SectionHeader label="Batterie" color={COLOR.battery} icon={BatteryCharging} testid="section-battery" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="battery-row">
          <div className="lg:col-span-5">
            <TruckiCard trucki={trucki} />
          </div>

          <div className="lg:col-span-4">
            <GlassCard
              title={batteryKind === "LADEN" ? "Akku lädt (netto)" : batteryKind === "ENTLADEN" ? "Akku entlädt (netto)" : "Akku (netto)"}
              accent={COLOR.battery}
              icon={BatteryCharging}
              testid="live-battery"
              danger={socDanger}
              badge={<Badge kind={batteryKind} />}
            >
              <MetricBig
                label={batteryKind === "LADEN" ? "Ladeleistung netto" : batteryKind === "ENTLADEN" ? "Entladeleistung netto" : "Leistung netto"}
                value={formatNum(Math.abs(summary.battery_power), 0)} unit="W"
                color="text-cyan-300 neon-text-cyan"
                sub={<Delta prev={prev?.summary?.battery_power} curr={summary.battery_power} />}
                sparkValues={trail.battery} sparkColor={COLOR.battery}
              />
              <div className="grid grid-cols-2 gap-2 mt-3" data-testid="battery-breakdown">
                <div className="glass-inset p-2" style={{ borderLeft: "3px solid #FACC15" }}>
                  <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Laden · MPPT</div>
                  <div className="font-mono text-lg font-medium text-yellow-300 mt-0.5" data-testid="battery-charge">{formatNum(summary.battery_charge_w, 0)}<span className="text-xs text-white/40"> W</span></div>
                </div>
                <div className="glass-inset p-2" style={{ borderLeft: "3px solid #06B6D4" }}>
                  <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Entladen · SUN</div>
                  <div className="font-mono text-lg font-medium text-cyan-300 mt-0.5" data-testid="battery-discharge">{formatNum(summary.battery_discharge_w, 0)}<span className="text-xs text-white/40"> W</span></div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="lg:col-span-3"><RoundTripCard today={today} /></div>
        </div>
      </div>

      {/* SEKTION · VICTRON */}
      <div className="space-y-3">
        <SectionHeader label="Victron" color={COLOR.victron} icon={Sun} testid="section-victron" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="mppt-row">
          <div className="lg:col-span-7">
            <VictronCard victron={victron} />
          </div>
          <div className="lg:col-span-5"><MpptCompare mppts={victron.mppts} /></div>
        </div>
      </div>

      {/* SEKTION · PV & NETZ */}
      <div className="space-y-3">
        <SectionHeader label="PV & Netz" color={COLOR.pv} icon={Sun} testid="section-pv-grid" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="pv-grid-row">
          <div className="lg:col-span-7">
            <GlassCard title="Hoymiles HM1500 · Kanäle" accent={COLOR.pv} icon={Sun} badge={<SourceBadge data={ahoy} />} testid="card-ahoy">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-3">
                  <MetricBig label="Total AC" value={formatNum(ahoy.total_power, 0)} unit="W" color="text-yellow-300 neon-text-yellow" size="sm" />
                  <Stat label="Limit" value={ahoy.limit_percent} unit="%" />
                </div>
                <div className="lg:col-span-3">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/65">
                        <th className="text-left py-1">CH</th><th className="text-right py-1">P</th><th className="text-right py-1">U</th>
                        <th className="text-right py-1">I</th><th className="text-right py-1">YDay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ahoy.channels?.map((c) => (
                        <tr key={c.ch} className="border-b border-white/5 text-white/85" data-testid={`ahoy-ch-${c.ch}`}>
                          <td className="py-1.5">CH{c.ch}</td>
                          <td className="py-1.5 text-right text-yellow-300 text-sm">{formatNum(c.power, 0)} W</td>
                          <td className="py-1.5 text-right">{formatNum(c.voltage, 1)} V</td>
                          <td className="py-1.5 text-right">{formatNum(c.current, 2)} A</td>
                          <td className="py-1.5 text-right">{formatNum(c.yield_day, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="lg:col-span-5"><GridHouseCard summary={summary} trail={trail} /></div>
        </div>
      </div>

      {/* SEKTION · SHELLY */}
      <div className="space-y-3">
        <SectionHeader label="Shelly" color={shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp} icon={Cable} testid="section-shelly" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="shelly-row">
          <div className="lg:col-span-8">
            <GlassCard
              title="Shelly Pro 3EM · 3-Phasen-Energiemesser"
              accent={shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}
              icon={Cable}
              badge={<SourceBadge data={shelly} />}
              testid="card-shelly"
            >
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                {shelly.phases?.map((p) => {
                  const isImport = p.power >= 0;
                  return (
                    <div key={p.phase} className="glass-inset p-3" data-testid={`shelly-${p.phase}`}>
                      <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 flex items-center justify-between">
                        <span>Phase {p.phase}</span>
                        <Cable size={12} className={isImport ? "text-red-300" : "text-emerald-300"} />
                      </div>
                      <div className={`font-mono text-2xl font-semibold tracking-tight mt-1.5 ${isImport ? "text-red-300 neon-text-red" : "text-emerald-300 neon-text-green"}`}>
                        <span className="opacity-70">{isImport ? "+" : "−"}</span>{formatNum(Math.abs(p.power), 1)}<span className="text-sm ml-1 text-white/45 font-normal">W</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-[11px] text-white/80">
                        <div><span className="text-white/50">U</span><br/>{formatNum(p.voltage, 1)} V</div>
                        <div><span className="text-white/50">I</span><br/>{formatNum(p.current, 2)} A</div>
                        <div><span className="text-white/50">PF</span><br/>{p.pf}</div>
                      </div>
                    </div>
                  );
                })}
                <div className="glass-inset p-3" style={{ borderLeft: `3px solid ${shelly.total_power >= 0 ? COLOR.grid_imp : COLOR.grid_exp}` }}>
                  <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Σ Total</div>
                  <div className={`font-mono text-2xl font-semibold tracking-tight mt-1.5 ${shelly.total_power >= 0 ? "text-red-300 neon-text-red" : "text-emerald-300 neon-text-green"}`}>
                    <span className="opacity-70">{shelly.total_power >= 0 ? "+" : "−"}</span>{formatNum(Math.abs(shelly.total_power), 1)}
                    <span className="text-sm ml-1 text-white/45 font-normal">W</span>
                  </div>
                  <div className="font-mono text-[10px] text-white/55 mt-3">
                    {shelly.total_power >= 0 ? "Bezug aus dem Netz" : "Einspeisung ins Netz"}
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="lg:col-span-4"><PhaseBalance phases={shelly.phases} /></div>
        </div>
      </div>
    </div>
  );
}
