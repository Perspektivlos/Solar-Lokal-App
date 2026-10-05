/* Tagesverlauf als Sonnen-Bogen: die Sonne wandert entlang eines Halbbogens
 * von Aufgang (links) bis Untergang (rechts); zentral die Rest-Sonnenstunden.
 * Auf-/Untergang kommen als reale UTC-Zeiten (Standort-abhängig) aus dem Live-
 * Payload; Anzeige in lokaler Zeit. */
import { useState } from "react";
import { Sun } from "lucide-react";
import { useMotion } from "../lib/motion";

const RX = 250;
const RY = 120;
const CX = 300;
const BASE = 150;
const H = 3600000;

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

export default function SunTimeline({ timestamp, sun }) {
  const [hover, setHover] = useState(null);
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

  const hourDots = [];
  if (hasSun) {
    const noonMs = (srMs + ssMs) / 2;
    const first = new Date(srMs);
    first.setMinutes(0, 0, 0);
    let t0 = first.getTime();
    if (t0 < srMs) t0 += H;
    for (let tMs = t0; tMs < ssMs; tMs += H) {
      const t = (tMs - srMs) / (ssMs - srMs);
      const p = arcPoint(t);
      const noonish = Math.abs(tMs - noonMs) < H / 2;
      hourDots.push(<circle key={tMs} cx={p.x} cy={p.y} r={noonish ? 2.4 : 1.6} fill="#ffffff" opacity={noonish ? 0.5 : 0.22} />);
    }
  }
  const srLabel = hasSun ? hhmm(srMs) : "–";
  const ssLabel = hasSun ? hhmm(ssMs) : "–";
  const noonLabel = hasSun ? hhmm((srMs + ssMs) / 2) : "–";

  // Dämmerungsphasen auf die Bogen-Parametrisierung abbilden
  const tOf = (iso) => (hasSun && iso ? (new Date(iso).getTime() - srMs) / (ssMs - srMs) : null);
  const tGM = tOf(sun?.golden_morning_end);
  const tGE = tOf(sun?.golden_evening_start);
  // Dämmerungs-Tails unter dem Horizont (visuell begrenzt, damit sie nicht überlaufen)
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

  return (
    <div className="glass-strong" data-testid="sun-timeline">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 flex items-center gap-2">
          <Sun size={12} className="text-yellow-300 neon-yellow" /> Tagesverlauf
        </div>
        <span className="font-mono text-[10px] text-white/60" data-testid="sun-timeline-status">{status}</span>
      </div>

      <div className="px-4 py-3">
        <svg viewBox="0 0 600 205" className="w-full" style={{ maxHeight: 250 }} data-testid="sun-timeline-svg">
          <defs>
            <linearGradient id="sunarc" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e8a13a" />
              <stop offset="50%" stopColor="#fcd34d" />
              <stop offset="100%" stopColor="#e8a13a" />
            </linearGradient>
          </defs>

          {/* Horizont */}
          <line x1="40" y1={BASE} x2="560" y2={BASE} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <line x1="40" y1={BASE} x2="560" y2={BASE} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="2 6" />

          {/* Bogen-Track */}
          <path d={`M 50 ${BASE} A ${RX} ${RY} 0 0 1 550 ${BASE}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />

          {/* Astronomische Dämmerung (Nacht, −18°) – dunkelste Zone, unter dem Horizont */}
          {astroDawnT != null && <path d={arcSub(astroDawnT, civilDawnT ?? -0.06)} fill="none" stroke="#4338ca" strokeWidth="3" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #4338ca)" }} data-testid="astro-dawn" />}
          {astroDuskT != null && <path d={arcSub(civilDuskT ?? 1.06, astroDuskT)} fill="none" stroke="#4338ca" strokeWidth="3" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #4338ca)" }} data-testid="astro-dusk" />}
          {/* Blaue Stunde (bürgerliche Dämmerung, −6°) */}
          {civilDawnT != null && <path d={arcSub(civilDawnT, 0)} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" opacity="0.85" style={{ filter: "drop-shadow(0 0 4px #3b82f6)" }} data-testid="blue-dawn" />}
          {civilDuskT != null && <path d={arcSub(1, civilDuskT)} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" opacity="0.85" style={{ filter: "drop-shadow(0 0 4px #3b82f6)" }} data-testid="blue-dusk" />}
          {/* Goldene Stunde (knapp über Horizont, leicht außen) */}
          {tGM != null && <path d={arcSub(0, Math.min(1, tGM), 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #f59e0b)" }} data-testid="golden-morning" />}
          {tGE != null && <path d={arcSub(Math.max(0, tGE), 1, 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #f59e0b)" }} data-testid="golden-evening" />}

          {/* Unsichtbare Hover-Flächen für die Dämmerungszonen */}
          {zones.map((z) => (
            <path key={`hit-${z.key}`} d={arcSub(z.t0, z.t1, z.ex, z.ex)} fill="none" stroke="transparent" strokeWidth="14"
                  style={{ cursor: "pointer" }} onMouseEnter={() => setHover(z.key)} onMouseLeave={() => setHover(null)} data-testid={`hit-${z.key}`} />
          ))}

          {/* zurückgelegter Teil (nur tagsüber) */}
          <path
            d={`M 50 ${BASE} A ${RX} ${RY} 0 0 1 550 ${BASE}`}
            fill="none"
            stroke="url(#sunarc)"
            strokeWidth="3.5"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${isDay ? dayT * 100 : 0} 100`}
            style={{ filter: "drop-shadow(0 0 4px rgba(252,211,77,0.5))" }}
            data-testid="sun-arc-progress"
          />

          {hourDots}

          {/* Zeiten (lokal) – außerhalb der Dämmerungs-Tails */}
          <text x="44" y="142" textAnchor="end" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(250,204,21,0.8)" data-testid="sun-sunrise-label">↑{srLabel}</text>
          <text x="556" y="142" textAnchor="start" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(192,132,252,0.85)" data-testid="sun-sunset-label">{ssLabel}↓</text>
          <text x={CX} y="22" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.4)">{noonLabel}</text>

          {/* Zentrale Anzeige: Rest-Sonnenstunden */}
          <text x={CX} y="92" textAnchor="middle" fontSize="38" fontFamily="JetBrains Mono" fontWeight="500" fill="#ffffff"
                style={isDay ? { filter: "drop-shadow(0 0 8px rgba(252,211,77,0.4))" } : undefined} data-testid="sun-rest-hours">
            {comma(restHours)}
            <tspan fontSize="16" fill="rgba(255,255,255,0.5)" dx="4">h</tspan>
          </text>
          <text x={CX} y="112" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.45)" letterSpacing="2">REST-SONNE HEUTE</text>

          {/* Marker: Sonne (Tag) / Mond (Nacht) */}
          {isDay ? (
            <g data-testid="sun-marker-day">
              {[...Array(8)].map((_, i) => {
                const a = (i * Math.PI) / 4;
                return <line key={i} x1={m.x + Math.cos(a) * 9} y1={m.y + Math.sin(a) * 9} x2={m.x + Math.cos(a) * 14} y2={m.y + Math.sin(a) * 14} stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" />;
              })}
              <circle cx={m.x} cy={m.y} r="14" fill="#fcd34d" opacity="0.18">
                {!reduced && <animate attributeName="r" values="12;16;12" dur="3s" repeatCount="indefinite" />}
              </circle>
              <circle cx={m.x} cy={m.y} r="7" fill="#fcd34d" style={{ filter: "drop-shadow(0 0 7px #fcd34d)" }} />
            </g>
          ) : (
            <g data-testid="sun-marker-night">
              <circle cx={m.x} cy={m.y} r="10" fill="#38bdf8" opacity="0.14" />
              <circle cx={m.x} cy={m.y} r="7" fill="#cbd5e1" style={{ filter: "drop-shadow(0 0 6px #38bdf8)" }} />
              <circle cx={m.x + 3} cy={m.y - 2} r="6" fill="#0d1320" />
            </g>
          )}

          {/* Phasen-Tooltip beim Überfahren */}
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
