/* Feststehende, schlanke Versions-Fußleiste (auf allen Seiten). Zeigt App-Name,
 * Version (Klick → Doku & Roadmap), aktuellen Modus (Demo/Live) und Stand-Datum.
 * Bei neuer Version wird die Versionsnummer kurz als „Neu" hervorgehoben. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getConfig } from "../lib/api";
import { APP_NAME, APP_VERSION, APP_LAST_UPDATED } from "../lib/appmeta";

export default function VersionFooter() {
  const [demo, setDemo] = useState(null);
  const [isNew] = useState(() => {
    try { return localStorage.getItem("solar.seenVersion") !== APP_VERSION; } catch { return false; }
  });

  useEffect(() => {
    let alive = true;
    getConfig().then((c) => { if (alive) setDemo(!!c?.demo_mode); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const modeKnown = demo !== null;

  return (
    <footer
      className="fixed bottom-0 inset-x-0 z-40 glass-strong border-0 border-t border-white/10"
      data-testid="version-footer"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-10 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8C92AC]/70">
        <div className="flex items-center gap-3 min-w-0">
          <span className="hidden md:inline text-white/55 truncate">{APP_NAME}</span>
          <Link
            to="/doku"
            data-testid="footer-version"
            title="Doku & Roadmap öffnen"
            className="inline-flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer underline decoration-dotted decoration-cyan-400/30 underline-offset-4"
          >
            v{APP_VERSION}
            {isNew && (
              <span
                className="not-italic normal-case tracking-normal text-[9px] px-1.5 py-0.5 rounded-full dot-pulse"
                style={{ color: "#0b0f1a", background: "#34d399", boxShadow: "0 0 8px #34d39988" }}
                data-testid="footer-version-new"
              >
                Neu
              </span>
            )}
          </Link>
          {modeKnown && (
            <span
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border"
              data-testid="footer-mode"
              style={demo
                ? { color: "#FACC15", borderColor: "#FACC1555", background: "#FACC151a" }
                : { color: "#34D399", borderColor: "#34D39955", background: "#34D3991a" }}
            >
              <span className="w-1.5 h-1.5 rounded-full dot-pulse" style={{ background: demo ? "#FACC15" : "#34D399" }} />
              {demo ? "Demo" : "Live"}
            </span>
          )}
          <span className="hidden sm:inline text-white/40">Stand: {APP_LAST_UPDATED}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden lg:inline" data-testid="footer-copyright">© {new Date().getFullYear()} THcentral.de</span>
          <a
            href="https://app.emergent.sh/?utm_source=emergent-badge"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-emergent-badge"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#050505]/70 border border-[#8C92AC]/15 px-2.5 py-0.5 normal-case tracking-normal text-[11px] text-white/70 hover:text-white hover:border-white/25 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M15.5702 8.13142C15.7729 8.0412 16.0007 8.18878 15.9892 8.4103C15.8374 11.3192 14.0965 14.0405 11.2531 15.3065C8.40964 16.5725 5.2224 16.0453 2.95912 14.2117C2.78676 14.072 2.82955 13.804 3.03219 13.7137L4.95677 12.8568C5.04866 12.8159 5.15446 12.823 5.24204 12.8725C6.73377 13.7153 8.59176 13.8649 10.2772 13.1145C11.9626 12.3641 13.0947 10.8833 13.4665 9.21075C13.4883 9.11256 13.5539 9.02918 13.6457 8.98827L15.5702 8.13142Z" fill="white"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M15.3066 4.74698L15.5067 5.19653C15.5759 5.35178 15.5061 5.53366 15.3508 5.60278L1.29992 11.8586C1.14467 11.9278 0.962794 11.8579 0.893675 11.7027L0.701732 11.2716L0.693457 11.2531C-1.10317 7.21778 0.711626 2.49007 4.74692 0.693443C8.78221 -1.10318 13.51 0.711693 15.3066 4.74698ZM2.82356 8.55367C2.63552 8.63739 2.41991 8.51617 2.40853 8.31065C2.28373 6.05724 3.53858 3.85787 5.72286 2.88536C7.90715 1.91286 10.3813 2.45199 11.9724 4.05256C12.1175 4.19854 12.0633 4.43988 11.8753 4.5236L2.82356 8.55367Z" fill="white"/>
            </svg>
            Made with Emergent
          </a>
        </div>
      </div>
    </footer>
  );
}
