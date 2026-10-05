/* Tagesverlauf als Sonnen-Bogen: die Sonne wandert entlang eines Halbbogens
 * von Aufgang (links) bis Untergang (rechts); zentral die Rest-Sonnenstunden.
 * Auf-/Untergang kommen als reale UTC-Zeiten (Standort-abhängig) aus dem Live-
 * Payload; Anzeige in lokaler Zeit. */
import { Sun } from "lucide-react";

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
  const tDawn = tOf(sun?.civil_dawn);
  const tDusk = tOf(sun?.civil_dusk);

  return (
    <div className="glass-strong" data-testid="sun-timeline">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75 flex items-center gap-2">
          <Sun size={12} className="text-yellow-300 neon-yellow" /> Tagesverlauf
        </div>
        <span className="font-mono text-[10px] text-white/60" data-testid="sun-timeline-status">{status}</span>
      </div>

      <div className="px-4 py-3">
        <svg viewBox="0 0 600 180" className="w-full" style={{ maxHeight: 240 }} data-testid="sun-timeline-svg">
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

          {/* Blaue Stunde (bürgerliche Dämmerung, unter dem Horizont) */}
          {tDawn != null && <path d={arcSub(tDawn, 0)} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" opacity="0.8" style={{ filter: "drop-shadow(0 0 4px #3b82f6)" }} data-testid="blue-dawn" />}
          {tDusk != null && <path d={arcSub(1, tDusk)} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" opacity="0.8" style={{ filter: "drop-shadow(0 0 4px #3b82f6)" }} data-testid="blue-dusk" />}
          {/* Goldene Stunde (knapp über Horizont, leicht außen) */}
          {tGM != null && <path d={arcSub(0, Math.min(1, tGM), 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #f59e0b)" }} data-testid="golden-morning" />}
          {tGE != null && <path d={arcSub(Math.max(0, tGE), 1, 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" style={{ filter: "drop-shadow(0 0 4px #f59e0b)" }} data-testid="golden-evening" />}

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

          {/* Stundenmarken-Beschriftung (lokale Zeit) */}
          <text x="50" y={BASE + 20} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(250,204,21,0.75)" data-testid="sun-sunrise-label">{srLabel}</text>
          <text x="50" y={BASE + 32} textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.4)" letterSpacing="1">AUFGANG</text>
          <text x="550" y={BASE + 20} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(192,132,252,0.8)" data-testid="sun-sunset-label">{ssLabel}</text>
          <text x="550" y={BASE + 32} textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.4)" letterSpacing="1">UNTERGANG</text>
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
                <animate attributeName="r" values="12;16;12" dur="3s" repeatCount="indefinite" />
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
        </svg>
        <div className="flex items-center justify-center gap-6 pb-2 -mt-1" data-testid="sun-legend">
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
