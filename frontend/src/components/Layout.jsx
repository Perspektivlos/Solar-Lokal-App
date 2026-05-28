import { NavLink, Outlet } from "react-router-dom";
import { Zap, Activity, Sliders, Cpu, PlugZap, Stethoscope } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: Zap, testid: "nav-dashboard", end: true },
  { to: "/verlauf", label: "Verlauf", icon: Activity, testid: "nav-history" },
  { to: "/steuerung", label: "Steuerung", icon: Sliders, testid: "nav-control" },
  { to: "/geraete", label: "Geräte", icon: Cpu, testid: "nav-devices" },
  { to: "/diagnose", label: "Diagnose", icon: Stethoscope, testid: "nav-diagnose" },
  { to: "/integrationen", label: "Integrationen", icon: PlugZap, testid: "nav-integrations" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] text-black">
      <header className="sticky top-0 z-50 bg-white border-b border-black">
        <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3" data-testid="brand">
            <div className="w-7 h-7 border border-black flex items-center justify-center">
              <Zap size={16} strokeWidth={2} />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-sm leading-none">SOLAR · LOKAL</div>
              <div className="font-mono text-[10px] text-gray-600 uppercase tracking-[0.2em] mt-0.5">Control Room</div>
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
                    `px-4 h-14 flex items-center gap-2 text-sm border-l border-black uppercase tracking-wider font-medium transition-colors ${
                      isActive ? "bg-black text-white" : "hover:bg-black hover:text-white"
                    }`
                  }
                >
                  <Icon size={14} strokeWidth={2} />
                  <span className="hidden sm:inline">{l.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-black bg-white">
        <div className="max-w-[1600px] mx-auto px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600 flex justify-between">
          <span>Lokale Steuerung · Mosquitto · InfluxDB · MongoDB</span>
          <span>v1.0 · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
