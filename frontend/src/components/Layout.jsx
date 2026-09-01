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

/**
 * Rendert das Hauptlayout der Anwendung mit Navigation, verschachtelten Routen und Footer.
 * @returns {JSX.Element} Das gerenderte Anwendungslayout.
 */
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
              <div className="font-semibold tracking-tight text-sm leading-none text-white">HauckLab · Solar'Projekt</div>
              <div className="font-mono text-[10px] text-white/55 uppercase tracking-[0.2em] mt-1">zur Zeit nur eine kleine App</div>
            </div>
          </div>
          <nav className="flex items-stretch h-full overflow-x-auto" data-testid="nav-menu">
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
                      <Icon size={14} strokeWidth={2} />
                      <span className="hidden lg:inline">{l.label}</span>
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
      <footer className="mt-12 border-t border-[#8C92AC]/12">
        <div className="max-w-[1600px] mx-auto px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8C92AC]/70 flex items-center justify-between flex-wrap gap-3">
          <span>Lokale Steuerung · Mosquitto · InfluxDB · MongoDB</span>
          <div className="flex items-center gap-4 flex-wrap">
            <span data-testid="footer-copyright">© {new Date().getFullYear()} THcentral.de</span>
            <span data-testid="footer-version" className="text-silver/70">
              v{process.env.REACT_APP_VERSION || "1.3.0"}
              {process.env.REACT_APP_BUILD_DATE ? ` · ${process.env.REACT_APP_BUILD_DATE}` : ""}
            </span>
            <a
              href="https://app.emergent.sh/?utm_source=emergent-badge"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-emergent-badge"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#050505]/70 border border-[#8C92AC]/15 px-2.5 py-1 normal-case tracking-normal text-[11px] text-silver/80 hover:text-silver hover:border-silver/25 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M15.5702 8.13142C15.7729 8.0412 16.0007 8.18878 15.9892 8.4103C15.8374 11.3192 14.0965 14.0405 11.2531 15.3065C8.40964 16.5725 5.2224 16.0453 2.95912 14.2117C2.78676 14.072 2.82955 13.804 3.03219 13.7137L4.95677 12.8568C5.04866 12.8159 5.15446 12.823 5.24204 12.8725C6.73377 13.7153 8.59176 13.8649 10.2772 13.1145C11.9626 12.3641 13.0947 10.8833 13.4665 9.21075C13.4883 9.11256 13.5539 9.02918 13.6457 8.98827L15.5702 8.13142Z" fill="white"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M15.3066 4.74698L15.5067 5.19653C15.5759 5.35178 15.5061 5.53366 15.3508 5.60278L1.29992 11.8586C1.14467 11.9278 0.962794 11.8579 0.893675 11.7027L0.701732 11.2716L0.693457 11.2531C-1.10317 7.21778 0.711626 2.49007 4.74692 0.693443C8.78221 -1.10318 13.51 0.711693 15.3066 4.74698ZM2.82356 8.55367C2.63552 8.63739 2.41991 8.51617 2.40853 8.31065C2.28373 6.05724 3.53858 3.85787 5.72286 2.88536C7.90715 1.91286 10.3813 2.45199 11.9724 4.05256C12.1175 4.19854 12.0633 4.43988 11.8753 4.5236L2.82356 8.55367Z" fill="white"/>
              </svg>
              Made with Emergent
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
