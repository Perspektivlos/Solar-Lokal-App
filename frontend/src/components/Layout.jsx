import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Zap, Activity, Sliders, Cpu, PlugZap, Stethoscope } from "lucide-react";
import VersionFooter from "./VersionFooter";
import WhatsNew from "./WhatsNew";
import SystemStatusLight from "./SystemStatusLight";
import { getRoadmap } from "../lib/api";
import { APP_VERSION } from "../lib/appmeta";

const links = [
  { to: "/", label: "Dashboard", icon: Zap, testid: "nav-dashboard", end: true },
  { to: "/verlauf", label: "Verlauf", icon: Activity, testid: "nav-history" },
  { to: "/steuerung", label: "Steuerung", icon: Sliders, testid: "nav-control" },
  { to: "/geraete", label: "Geräte", icon: Cpu, testid: "nav-devices" },
  { to: "/diagnose", label: "Diagnose", icon: Stethoscope, testid: "nav-diagnose" },
  { to: "/integrationen", label: "Integrationen", icon: PlugZap, testid: "nav-integrations" },
];

export default function Layout() {
  const [roadmap, setRoadmap] = useState([]);
  const [wnOpen, setWnOpen] = useState(false);
  const [newItems, setNewItems] = useState([]);

  useEffect(() => {
    let alive = true;
    getRoadmap().then(({ items }) => {
      if (!alive) return;
      const list = items || [];
      setRoadmap(list);
      const doneIds = list.filter((i) => i.status === "done").map((i) => i.id);
      let seen = null;
      try { seen = JSON.parse(localStorage.getItem("solar.seenDoneIds")); } catch { seen = null; }
      if (!Array.isArray(seen)) {
        // Erststart mit diesem Feature: Basislinie still setzen, kein Popup.
        try {
          localStorage.setItem("solar.seenDoneIds", JSON.stringify(doneIds));
          localStorage.setItem("solar.seenVersion", APP_VERSION);
        } catch { /* ignore */ }
        return;
      }
      const fresh = list.filter((i) => i.status === "done" && !seen.includes(i.id));
      if (fresh.length > 0) { setNewItems(fresh); setWnOpen(true); }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const persistSeen = () => {
    try {
      const doneIds = roadmap.filter((i) => i.status === "done").map((i) => i.id);
      localStorage.setItem("solar.seenDoneIds", JSON.stringify(doneIds));
      localStorage.setItem("solar.seenVersion", APP_VERSION);
    } catch { /* ignore */ }
  };
  const dismissWn = () => { setWnOpen(false); persistSeen(); };
  const openWn = () => {
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem("solar.seenDoneIds")) || []; } catch { seen = []; }
    setNewItems(roadmap.filter((i) => i.status === "done" && !seen.includes(i.id)));
    setWnOpen(true);
  };

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
              <div className="font-semibold tracking-tight text-sm leading-none text-white">HauckLab · Solar'Projekt</div>
              <div className="hidden sm:block font-mono text-[10px] text-white/55 uppercase tracking-[0.2em] mt-1 whitespace-nowrap">Hoymiles HM-1500 + 2x Victron MPPT • 48V LiFePO4 • Shelly Pro 3EM</div>
            </div>
          </div>
          <nav className="flex items-stretch h-full min-w-0 flex-1 lg:justify-end overflow-x-auto whitespace-nowrap" data-testid="nav-menu">
            <div className="flex items-center pr-3 mr-1 border-r border-white/10">
              <SystemStatusLight />
            </div>
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  aria-label={l.label}
                  data-testid={l.testid}
                  className={({ isActive }) =>
                    `px-3 lg:px-4 h-16 flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-medium transition-all relative shrink-0 ${
                      isActive
                        ? "text-white"
                        : "text-white/55 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="nav-plate absolute inset-x-1 inset-y-2.5 pointer-events-none" />
                      )}
                      <Icon size={14} strokeWidth={2} className="relative z-10" />
                      <span className="hidden lg:inline relative z-10">{l.label}</span>
                      {isActive && (
                        <span className="absolute bottom-[9px] left-[calc(25%+6px)] right-[calc(25%+6px)] h-[2px] z-10"
                              style={{ background: "linear-gradient(90deg, transparent, #06B6D4, transparent)", boxShadow: "0 0 8px #06B6D4aa" }} />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-6 pt-6 pb-20 relative z-10">
        <Outlet context={{ openWhatsNew: openWn }} />
      </main>
      <VersionFooter onOpenWhatsNew={openWn} />
      <WhatsNew open={wnOpen} items={newItems} onClose={dismissWn} />
    </div>
  );
}
