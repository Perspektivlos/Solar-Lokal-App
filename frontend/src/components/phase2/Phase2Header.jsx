import { ArrowLeft, BatteryCharging, RefreshCw } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { statusMeta } from "../smartshunt/format";

const NAV = [
  ["", "Dashboard"], ["energiefluss", "Energiefluss"], ["geraete", "Geräte"],
  ["diagnose", "Diagnose"], ["verlauf", "Verlauf"],
];

export const Phase2Header = ({ live, refreshing, onRefresh }) => {
  const status = statusMeta(live?.battery_dc?.status);
  return <header className="border-b border-white/10 bg-[#070b13]/95" data-testid="phase2-header">
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" data-testid="phase2-back-dashboard" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300 hover:text-cyan-100 transition-colors"><ArrowLeft size={13} /> Haupt-Dashboard</Link>
        <div className="flex items-center gap-2">
          <span data-testid="phase2-preview-badge" className="rounded border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200">Phase 2 Vorschau</span>
          {live?.demo_mode && <span data-testid="phase2-demo-badge" className="rounded border border-amber-400/35 bg-amber-400/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-amber-200">Demo / Mock</span>}
        </div>
      </div>
      <div className="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-cyan-400/35 bg-cyan-400/10 text-cyan-300"><BatteryCharging size={20} /></span>
          <div className="min-w-0"><div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">SmartShunt DC × Trucki/SUN AC</div><h1 className="text-2xl sm:text-3xl font-semibold text-white" data-testid="phase2-title">Batterie-Quellenmodell</h1></div>
        </div>
        <div className="flex items-center gap-2">
          <span data-testid="phase2-battery-status" className={`rounded-full border px-3 py-1 font-mono text-[9px] tracking-[0.15em] ${status.className}`}>{status.label}</span>
          <button type="button" onClick={onRefresh} disabled={refreshing} data-testid="phase2-refresh-button" className="btn-neo inline-flex h-8 items-center gap-2 px-3 font-mono text-[9px] uppercase tracking-[0.12em] disabled:opacity-50"><RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Aktualisieren</button>
        </div>
      </div>
      <nav className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-1.5" data-testid="phase2-navigation">
        {NAV.map(([path, label]) => <NavLink key={path} end={path === ""} to={`/smartshunt-phase2${path ? `/${path}` : ""}`} data-testid={`phase2-nav-${path || "dashboard"}`} className={({ isActive }) => `h-9 grid place-items-center rounded border font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${isActive ? "border-cyan-400/45 bg-cyan-400/12 text-cyan-200" : "border-white/10 bg-black/20 text-white/45 hover:text-white"}`}>{label}</NavLink>)}
      </nav>
    </div>
  </header>;
};