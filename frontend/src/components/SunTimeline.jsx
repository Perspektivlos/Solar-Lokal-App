/* Tagesverlauf – wahlweise als Sonnen-Bogen oder horizontaler Balken.
 * Die Sonne wandert von Aufgang bis Untergang; zentral die Rest-Sonnenstunden.
 * Auf-/Untergang kommen als reale UTC-Zeiten (standortabhängig) aus dem Live-
 * Payload; Anzeige in lokaler Zeit. Dämmerungsphasen (golden/blau/astronomisch)
 * werden in beiden Ansichten farbig dargestellt. */
import { useState } from "react";
import { Sun, LineChart, AlignHorizontalJustifyStart } from "lucide-react";
import { useMotion } from "../lib/motion";

const RX = 250;
const RY = 120;
const CX = 300;
const BASE = 150;
const H = 3600000;

// Balken-Geometrie
const BX0 = 60;
const BX1 = 540;
const BY = 92;
const BH = 42;

const arcPoint = (t) => {
  const th = Math.PI * (1 - t);
  return { x: CX + RX * Math.cos(th), y: BASE - RY * Math.sin(th) };
};
const arcSub = (t0, t1, ex = 0, ey = 0) => {
  const rx = RX + ex, ry = RY + ey;
  const a = { x: CX + rx * Math.cos(Math.PI * (1 - t0)), y: BASE - ry * Math.sin(Math.PI * (1 - t0)) };
  const b = { x: CX + rx * Math.cos(Math.PI * (1 - t1)), y: BASE - ry * Math.sin(Math.PI * (1 - t1)) };
  return `M ${a.x} ${a.y} A ${rx} ${ry} 0 0 1 ${b.x} ${b.y}`;
};
const comma = (n) => n.toFixed(1).replace(".", ",");
const hhmm = (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

const VIEW_KEY = "suntimeline-view";

export default function SunTimeline({ timestamp, sun }) {
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || "balken"; } catch { return "balken"; }
  });
  const setViewPersist = (v) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };
  const { reduced } = useMotion();
  const nowMs = timestamp ? new Date(timestamp).getTime() : Date.now();
  const srMs = sun?.sunrise ? new Date(sun.sunrise).getTime() : null;
  const ssMs = sun?.sunset ? new Date(sun.sunset).getTime() : null;
  const hasSun = srMs != null && ssMs != null && ssMs > srMs;

  const isDay = hasSun && nowMs >= srMs && nowMs < ssMs;
  const dayT = hasSun ? Math.max(0, Math.min(1, (nowMs - srMs) / (ssMs - srMs))) : 0;
  const markerT = isDay ? dayT : hasSun && nowMs < srMs ? 0 : 1;
  const m = arcPoint(markerT);

  let restHours = 0;
  if (hasSun) {
    if (isDay) restHours = (ssMs - nowMs) / H;
    else if (nowMs < srMs) restHours = (ssMs - srMs) / H;
  }
  const toRise = hasSun ? (nowMs < srMs ? (srMs - nowMs) / H : (srMs + 86400000 - nowMs) / H) : 0;
  const status = !hasSun ? "Sonnenzeiten n/v" : isDay ? `Rest-Sonne ${comma(restHours)} h` : `Sonnenaufgang in ${comma(toRise)} h`;

  const srLabel = hasSun ? hhmm(srMs) : "–";
  const ssLabel = hasSun ? hhmm(ssMs) : "–";
  const noonLabel = hasSun ? hhmm((srMs + ssMs) / 2) : "–";

  // Dämmerungsphasen auf die t-Parametrisierung (0=Aufgang, 1=Untergang) abbilden
  const tOf = (iso) => (hasSun && iso ? (new Date(iso).getTime() - srMs) / (ssMs - srMs) : null);
  const tGM = tOf(sun?.golden_morning_end);
  const tGE = tOf(sun?.golden_evening_start);
  const civilDawnT = sun?.civil_dawn ? Math.max(tOf(sun.civil_dawn), -0.06) : null;
  const astroDawnT = sun?.astro_dawn ? Math.max(tOf(sun.astro_dawn), -0.12) : null;
  const civilDuskT = sun?.civil_dusk ? Math.min(tOf(sun.civil_dusk), 1.06) : null;
  const astroDuskT = sun?.astro_dusk ? Math.min(tOf(sun.astro_dusk), 1.12) : null;

  // Hover-Zonen (Dämmerungsphasen) mit genauen Zeiten
  const zones = [];
  const addZone = (key, label, color, t0, t1, from, to, ex = 0) => {
    if (t0 != null && t1 != null && from && to) zones.push({ key, label, color, t0, t1, from, to, ex });
  };
  addZone("astro-dawn", "Astron. Dämmerung", "#4338ca", astroDawnT, civilDawnT ?? -0.06, sun?.astro_dawn, sun?.civil_dawn ?? sun?.sunrise);
  addZone("blue-dawn", "Blaue Stunde", "#3b82f6", civilDawnT, 0, sun?.civil_dawn, sun?.sunrise);
  addZone("golden-morning", "Goldene Stunde", "#f59e0b", 0, tGM != null ? Math.min(1, tGM) : null, sun?.sunrise, sun?.golden_morning_end, 6);
  addZone("golden-evening", "Goldene Stunde", "#f59e0b", tGE != null ? Math.max(0, tGE) : null, 1, sun?.golden_evening_start, sun?.sunset, 6);
  addZone("blue-dusk", "Blaue Stunde", "#3b82f6", 1, civilDuskT, sun?.sunset, sun?.civil_dusk);
  addZone("astro-dusk", "Astron. Dämmerung", "#4338ca", civilDuskT ?? 1.06, astroDuskT, sun?.civil_dusk, sun?.astro_dusk);
  const hz = zones.find((z) => z.key === hover);

  // ── Balken-Hilfen ───────────────────────────────────────────────────────
  const tcands = [astroDawnT, civilDawnT, 0, 1, civilDuskT, astroDuskT].filter((v) => v != null);
  const TMIN = hasSun ? Math.min(...tcands, 0) : 0;
  const TMAX = hasSun ? Math.max(...tcands, 1) : 1;
  const xOf = (t) => BX0 + ((Math.max(TMIN, Math.min(TMAX, t)) - TMIN) / (TMAX - TMIN || 1)) * (BX1 - BX0);
  const xMarker = xOf(markerT);

  const sunGlyph = (cx, cy, r) => (
    <g>
      {[...Array(8)].map((_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(a) * (r + 1)} y1={cy + Math.sin(a) * (r + 1)} x2={cx + Math.cos(a) * (r + 5)} y2={cy + Math.sin(a) * (r + 5)} stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" />;
      })}
      <circle cx={cx} cy={cy} r={r + 5} fill="#fcd34d" opacity="0.18">
        {!reduced && <animate attributeName="r" values={`${r + 3};${r + 7};${r + 3}`} dur="3s" repeatCount="indefinite" />}
      </circle>
      <circle cx={cx} cy={cy} r={r} fill="#fcd34d" style={{ filter: "drop-shadow(0 0 7px #fcd34d)" }} />
    </g>
  );
  const moonGlyph = (cx, cy, r) => (
    <g>
      <circle cx={cx} cy={cy} r={r + 3} fill="#38bdf8" opacity="0.14" />
      <circle cx={cx} cy={cy} r={r} fill="#cbd5e1" style={{ filter: "drop-shadow(0 0 6px #38bdf8)" }} />
      <circle cx={cx + 3} cy={cy - 2} r={r - 1} fill="#0d1320" />
    </g>
  );

  return (
    <div className="glass-strong" data-testid="sun-timeline">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 flex items-center gap-2">
          <Sun size={12} className="text-yellow-300 neon-yellow" /> Tagesverlauf
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-white/60" data-testid="sun-timeline-status">{status}</span>
          <div className="inline-flex rounded-md overflow-hidden border border-white/12" role="group" aria-label="Ansicht" data-testid="sun-view-toggle">
            <button type="button" onClick={() => setViewPersist("balken")} aria-pressed={view === "balken"} data-testid="sun-view-balken"
              title="Balken-Ansicht"
              className={`px-2 py-1 transition-colors ${view === "balken" ? "bg-cyan-400/20 text-cyan-200" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
              <AlignHorizontalJustifyStart size={13} />
            </button>
            <button type="button" onClick={() => setViewPersist("bogen")} aria-pressed={view === "bogen"} data-testid="sun-view-bogen"
              title="Bogen-Ansicht"
              className={`px-2 py-1 transition-colors ${view === "bogen" ? "bg-cyan-400/20 text-cyan-200" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
              <LineChart size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {view === "bogen" ? (
          <svg viewBox="0 0 600 205" className="w-full" style={{ maxHeight: 250 }} data-testid="sun-timeline-svg">
            <defs>
              <linearGradient id="sunarc" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e8a13a" />
                <stop offset="50%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#e8a13a" />
              </linearGradient>
            </defs>

            <line x1="40" y1={BASE} x2="560" y2={BASE} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
            <line x1="40" y1={BASE} x2="560" y2={BASE} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="2 6" />
            <path d={`M 50 ${BASE} A ${RX} ${RY} 0 0 1 550 ${BASE}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />

            {astroDawnT != null && <path d={arcSub(astroDawnT, civilDawnT ?? -0.06)} fill="none" stroke="#4338ca" strokeWidth="3" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #4338ca)" }} data-testid="astro-dawn" />}
            {astroDuskT != null && <path d={arcSub(civilDuskT ?? 1.06, astroDuskT)} fill="none" stroke="#4338ca" strokeWidth="3" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #4338ca)" }} data-testid="astro-dusk" />}
            {civilDawnT != null && <path d={arcSub(civilDawnT, 0)} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" opacity="0.85" style={{ filter: "drop-shadow(0 0 4px #3b82f6)" }} data-testid="blue-dawn" />}
            {civilDuskT != null && <path d={arcSub(1, civilDuskT)} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" opacity="0.85" style={{ filter: "drop-shadow(0 0 4px #3b82f6)" }} data-testid="blue-dusk" />}
            {tGM != null && <path d={arcSub(0, Math.min(1, tGM), 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #f59e0b)" }} data-testid="golden-morning" />}
            {tGE != null && <path d={arcSub(Math.max(0, tGE), 1, 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #f59e0b)" }} data-testid="golden-evening" />}

            {zones.map((z) => (
              <path key={`hit-${z.key}`} d={arcSub(z.t0, z.t1, z.ex, z.ex)} fill="none" stroke="transparent" strokeWidth="14"
                    style={{ cursor: "pointer" }} onMouseEnter={() => setHover(z.key)} onMouseLeave={() => setHover(null)} data-testid={`hit-${z.key}`} />
            ))}

            <path d={`M 50 ${BASE} A ${RX} ${RY} 0 0 1 550 ${BASE}`} fill="none" stroke="url(#sunarc)" strokeWidth="3.5" strokeLinecap="round"
                  pathLength="100" strokeDasharray={`${isDay ? dayT * 100 : 0} 100`} style={{ filter: "drop-shadow(0 0 4px rgba(252,211,77,0.5))" }} data-testid="sun-arc-progress" />

            {hasSun && (() => {
              const noonMs = (srMs + ssMs) / 2;
              const first = new Date(srMs); first.setMinutes(0, 0, 0);
              let t0 = first.getTime(); if (t0 < srMs) t0 += H;
              const dots = [];
              for (let tMs = t0; tMs < ssMs; tMs += H) {
                const t = (tMs - srMs) / (ssMs - srMs); const p = arcPoint(t);
                const noonish = Math.abs(tMs - noonMs) < H / 2;
                dots.push(<circle key={tMs} cx={p.x} cy={p.y} r={noonish ? 2.4 : 1.6} fill="#ffffff" opacity={noonish ? 0.5 : 0.22} />);
              }
              return dots;
            })()}

            <text x="44" y="142" textAnchor="end" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(250,204,21,0.8)" data-testid="sun-sunrise-label">↑{srLabel}</text>
            <text x="556" y="142" textAnchor="start" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(192,132,252,0.85)" data-testid="sun-sunset-label">{ssLabel}↓</text>
            <text x={CX} y="22" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.4)">{noonLabel}</text>

            <text x={CX} y="92" textAnchor="middle" fontSize="38" fontFamily="JetBrains Mono" fontWeight="500" fill="#ffffff"
                  style={isDay ? { filter: "drop-shadow(0 0 8px rgba(252,211,77,0.4))" } : undefined} data-testid="sun-rest-hours">
              {comma(restHours)}
              <tspan fontSize="16" fill="rgba(255,255,255,0.5)" dx="4">h</tspan>
            </text>
            <text x={CX} y="112" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.45)" letterSpacing="2">REST-SONNE HEUTE</text>

            {isDay ? <g data-testid="sun-marker-day">{sunGlyph(m.x, m.y, 7)}</g> : <g data-testid="sun-marker-night">{moonGlyph(m.x, m.y, 7)}</g>}

            {hz && (
              <g data-testid="phase-tooltip" style={{ pointerEvents: "none" }}>
                {(() => {
                  const txt = `${hz.label} · ${hhmm(new Date(hz.from).getTime())}–${hhmm(new Date(hz.to).getTime())}`;
                  const w = 26 + txt.length * 6.0;
                  return (
                    <>
                      <rect x={CX - w / 2} y={42} width={w} height={21} rx={5} fill="rgba(2,6,16,0.96)" stroke={hz.color} strokeWidth="1" style={{ filter: `drop-shadow(0 0 6px ${hz.color}66)` }} />
                      <text x={CX} y={56} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="#ffffff" data-testid="phase-tooltip-text">{txt}</text>
                    </>
                  );
                })()}
              </g>
            )}
          </svg>
        ) : (
          <svg viewBox="0 0 600 170" className="w-full" style={{ maxHeight: 210 }} data-testid="sun-timeline-bar">
            <defs>
              <linearGradient id="barday" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            {/* Rest-Sonne (zentral oben) */}
            <text x={CX} y="34" textAnchor="middle" fontSize="30" fontFamily="JetBrains Mono" fontWeight="500" fill="#ffffff"
                  style={isDay ? { filter: "drop-shadow(0 0 8px rgba(252,211,77,0.4))" } : undefined} data-testid="sun-rest-hours">
              {comma(restHours)}
              <tspan fontSize="14" fill="rgba(255,255,255,0.5)" dx="4">h</tspan>
            </text>
            <text x={CX} y="52" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.45)" letterSpacing="2">REST-SONNE HEUTE</text>

            {/* Basis-Balken (Nacht) */}
            <rect x={BX0} y={BY} width={BX1 - BX0} height={BH} rx={8} fill="#0a0f1c" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

            {hasSun && (
              <>
                {/* Tagband */}
                <rect x={xOf(0)} y={BY} width={Math.max(0, xOf(1) - xOf(0))} height={BH} fill="url(#barday)" opacity="0.55" />
                {/* Dämmerungs-Segmente */}
                {zones.map((z) => {
                  const xa = xOf(Math.min(z.t0, z.t1)); const xb = xOf(Math.max(z.t0, z.t1));
                  return <rect key={`seg-${z.key}`} x={xa} y={BY} width={Math.max(0, xb - xa)} height={BH} fill={z.color} opacity="0.8" style={{ filter: `drop-shadow(0 0 4px ${z.color}88)` }} data-testid={`bar-${z.key}`} />;
                })}
                {/* vergangener Tagesanteil */}
                {isDay && <rect x={xOf(0)} y={BY} width={Math.max(0, xMarker - xOf(0))} height={BH} fill="rgba(255,255,255,0.16)" />}
                {/* Rahmen über alles */}
                <rect x={BX0} y={BY} width={BX1 - BX0} height={BH} rx={8} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />

                {/* Stunden-Ticks */}
                {(() => {
                  const first = new Date(srMs); first.setMinutes(0, 0, 0);
                  let t0 = first.getTime(); if (t0 < srMs) t0 += H;
                  const ticks = [];
                  for (let tMs = t0; tMs < ssMs; tMs += H) {
                    const t = (tMs - srMs) / (ssMs - srMs); const x = xOf(t);
                    ticks.push(<line key={tMs} x1={x} y1={BY + BH - 6} x2={x} y2={BY + BH} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />);
                  }
                  return ticks;
                })()}

                {/* Hover-Flächen für Zonen */}
                {zones.map((z) => {
                  const xa = xOf(Math.min(z.t0, z.t1)); const xb = xOf(Math.max(z.t0, z.t1));
                  return <rect key={`hit-${z.key}`} x={xa} y={BY - 4} width={Math.max(2, xb - xa)} height={BH + 8} fill="transparent" style={{ cursor: "pointer" }}
                               onMouseEnter={() => setHover(z.key)} onMouseLeave={() => setHover(null)} data-testid={`hit-${z.key}`} />;
                })}

                {/* Marker (Sonne/Mond) + Linie */}
                <line x1={xMarker} y1={BY - 8} x2={xMarker} y2={BY + BH + 8} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="2 3" />
                {isDay ? <g data-testid="sun-marker-day">{sunGlyph(xMarker, BY - 16, 6)}</g> : <g data-testid="sun-marker-night">{moonGlyph(xMarker, BY - 16, 6)}</g>}

                {/* Zeit-Labels */}
                <text x={xOf(0)} y={BY + BH + 18} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(250,204,21,0.85)" data-testid="sun-sunrise-label">↑{srLabel}</text>
                <text x={xOf(0.5)} y={BY + BH + 18} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.45)">{noonLabel}</text>
                <text x={xOf(1)} y={BY + BH + 18} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(192,132,252,0.9)" data-testid="sun-sunset-label">{ssLabel}↓</text>
              </>
            )}

            {hz && (() => {
              const cxh = Math.max(90, Math.min(510, (xOf(hz.t0) + xOf(hz.t1)) / 2));
              const txt = `${hz.label} · ${hhmm(new Date(hz.from).getTime())}–${hhmm(new Date(hz.to).getTime())}`;
              const w = 26 + txt.length * 6.0;
              return (
                <g data-testid="phase-tooltip" style={{ pointerEvents: "none" }}>
                  <rect x={cxh - w / 2} y={BY - 40} width={w} height={21} rx={5} fill="rgba(2,6,16,0.96)" stroke={hz.color} strokeWidth="1" style={{ filter: `drop-shadow(0 0 6px ${hz.color}66)` }} />
                  <text x={cxh} y={BY - 26} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="#ffffff" data-testid="phase-tooltip-text">{txt}</text>
                </g>
              );
            })()}
          </svg>
        )}

        <div className="flex items-center justify-center gap-5 pb-2 -mt-1" data-testid="sun-legend">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
            <span className="w-2 h-2 rounded-full" style={{ background: "#4338ca", boxShadow: "0 0 5px #4338ca" }} /> Astronom. Nacht
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
            <span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6", boxShadow: "0 0 5px #3b82f6" }} /> Blaue Stunde
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
            <span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 5px #f59e0b" }} /> Goldene Stunde
          </span>
        </div>
      </div>
    </div>
  );
}
