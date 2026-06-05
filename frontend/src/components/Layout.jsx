import { NavLink, Outlet } from "react-router-dom";
import { Zap, Activity, Sliders, Cpu, PlugZap, Stethoscope, Sun } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: Zap, testid: "nav-dashboard", end: true },
  { to: "/verlauf", label: "Verlauf", icon: Activity, testid: "nav-history" },
  { to: "/forecast", label: "Forecast", icon: Sun, testid: "nav-forecast" },
  { to: "/steuerung", label: "Steuerung", icon: Sliders, testid: "nav-control" },
  { to: "/geraete", label: "Geräte", icon: Cpu, testid: "nav-devices" },
  { to: "/diagnose", label: "Diagnose", icon: Stethoscope, testid: "nav-diagnose" },
  { to: "/integrationen", label: "Integrationen", icon: PlugZap, testid: "nav-integrations" },
];

export default function Layout() {
  return (
    <div className="min-h-screen text-white">
      <header className="sticky top-0 z-50 glass-strong border-0 border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3" data-testid="brand">
            <div className="relative w-9 h-9 rounded-md flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, rgba(250,204,21,0.25), rgba(6,182,212,0.15))",
                          border: "1px solid rgba(250,204,21,0.30)" }}>
              <Zap size={18} strokeWidth={2.5} className="text-yellow-300 neon-yellow" />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-sm leading-none text-white">SOLAR · LOKAL</div>
              <div className="font-mono text-[10px] text-white/55 uppercase tracking-[0.2em] mt-1">Control Room</div>
            </div>
          </div>
          <nav className="flex items-stretch h-full" data-testid="nav-menu">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  data-testid={l.testid}
                  className={({ isActive }) =>
                    `px-4 h-16 flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-medium transition-all relative ${
                      isActive
                        ? "text-white"
                        : "text-white/55 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={14} strokeWidth={2} />
                      <span className="hidden sm:inline">{l.label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px]"
                              style={{ background: "linear-gradient(90deg, transparent, #06B6D4, transparent)" }} />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-6 py-6 relative z-10">
        <Outlet />
      </main>
      <footer className="mt-12 border-t border-white/5">
        <div className="max-w-[1600px] mx-auto px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 flex justify-between flex-wrap gap-2">
          <span>Lokale Steuerung · Mosquitto · InfluxDB · MongoDB</span>
          <span>v1.1 · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
