/* Tagesverlauf – wahlweise als Sonnen-Bogen oder horizontaler Balken.
 * Die Sonne wandert von Aufgang bis Untergang; zentral die Rest-Sonnenstunden.
 * Auf-/Untergang kommen als reale UTC-Zeiten (standortabhängig) aus dem Live-
 * Payload; Anzeige in lokaler Zeit. Dämmerungsphasen (golden/blau/astronomisch)
 * werden in beiden Ansichten farbig dargestellt. */
import { useState } from "react";
import { Sun, LineChart, AlignHorizontalJustifyStart, ArrowUp, ArrowDown } from "lucide-react";
import { useMotion } from "../lib/motion";

const RX = 230;
const RY = 100;
const CX = 300;
const BASE = 140;
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

  const sunGlyph = (cx, cy) => (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="none" stroke="#FDE047" strokeWidth="1" opacity="0.25">
        {!reduced && <animate attributeName="opacity" values="0.15;0.4;0.15" dur="4s" repeatCount="indefinite" />}
      </circle>
      <circle cx={cx} cy={cy} r={6} fill="#FDE047" />
    </g>
  );
  const moonGlyph = (cx, cy) => (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="none" stroke="#7DD3FC" strokeWidth="1" opacity="0.25" />
      <circle cx={cx} cy={cy} r={6} fill="#7DD3FC" />
      <circle cx={cx + 2.5} cy={cy - 1.5} r={5} fill="#070c18" />
    </g>
  );
  const toggleBtn = (active) =>
    `px-2 py-1 rounded-md transition-colors ${active ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-white/40 border border-transparent hover:text-white/80 hover:bg-white/5"}`;

  return (
    <div className="glass-strong rounded-xl overflow-hidden px-5 py-4 sm:px-6 sm:py-5 space-y-4" data-testid="sun-timeline">
      <div className="border-b border-white/[0.08] pb-3 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 flex items-center gap-2">
          <Sun size={12} className="text-yellow-300" /> Tagesverlauf
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-cyan-300/80 tracking-wide" data-testid="sun-timeline-status">{status}</span>
          <div className="inline-flex gap-0.5 rounded-lg p-0.5 bg-black/40 border border-white/10" role="group" aria-label="Ansicht" data-testid="sun-view-toggle">
            <button type="button" onClick={() => setViewPersist("balken")} aria-pressed={view === "balken"} data-testid="sun-view-balken"
              title="Balken-Ansicht" className={toggleBtn(view === "balken")}>
              <AlignHorizontalJustifyStart size={13} />
            </button>
            <button type="button" onClick={() => setViewPersist("bogen")} aria-pressed={view === "bogen"} data-testid="sun-view-bogen"
              title="Bogen-Ansicht" className={toggleBtn(view === "bogen")}>
              <LineChart size={13} />
            </button>
          </div>
        </div>
      </div>

      <div>
        {view === "bogen" ? (
          <svg viewBox="0 0 600 185" className="w-full h-auto" style={{ maxHeight: 220 }} data-testid="sun-timeline-svg">
            <defs>
              <linearGradient id="sunarc" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e8a13a" />
                <stop offset="50%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#e8a13a" />
              </linearGradient>
            </defs>

            <line x1="50" y1={BASE} x2="550" y2={BASE} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 6" />
            <path d={`M ${CX - RX} ${BASE} A ${RX} ${RY} 0 0 1 ${CX + RX} ${BASE}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />

            {astroDawnT != null && <path d={arcSub(astroDawnT, civilDawnT ?? -0.06)} fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" data-testid="astro-dawn" />}
            {astroDuskT != null && <path d={arcSub(civilDuskT ?? 1.06, astroDuskT)} fill="none" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" data-testid="astro-dusk" />}
            {civilDawnT != null && <path d={arcSub(civilDawnT, 0)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" data-testid="blue-dawn" />}
            {civilDuskT != null && <path d={arcSub(1, civilDuskT)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" data-testid="blue-dusk" />}
            {tGM != null && <path d={arcSub(0, Math.min(1, tGM), 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.85" data-testid="golden-morning" />}
            {tGE != null && <path d={arcSub(Math.max(0, tGE), 1, 6, 6)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.85" data-testid="golden-evening" />}

            {zones.map((z) => (
              <path key={`hit-${z.key}`} d={arcSub(z.t0, z.t1, z.ex, z.ex)} fill="none" stroke="transparent" strokeWidth="14"
                    style={{ cursor: "pointer" }} onMouseEnter={() => setHover(z.key)} onMouseLeave={() => setHover(null)} data-testid={`hit-${z.key}`} />
            ))}

            <path d={`M ${CX - RX} ${BASE} A ${RX} ${RY} 0 0 1 ${CX + RX} ${BASE}`} fill="none" stroke="url(#sunarc)" strokeWidth="2.5" strokeLinecap="round"
                  pathLength="100" strokeDasharray={`${isDay ? dayT * 100 : 0} 100`} data-testid="sun-arc-progress" />

            {hasSun && (() => {
              const noonMs = (srMs + ssMs) / 2;
              const first = new Date(srMs); first.setMinutes(0, 0, 0);
              let t0 = first.getTime(); if (t0 < srMs) t0 += H;
              const dots = [];
              for (let tMs = t0; tMs < ssMs; tMs += H) {
                const t = (tMs - srMs) / (ssMs - srMs); const p = arcPoint(t);
                const noonish = Math.abs(tMs - noonMs) < H / 2;
                dots.push(<circle key={tMs} cx={p.x} cy={p.y} r={noonish ? 2 : 1.3} fill="#ffffff" opacity={noonish ? 0.4 : 0.18} />);
              }
              return dots;
            })()}

            <text x={CX - RX - 8} y={BASE - 2} textAnchor="end" fontSize="10" fontFamily="JetBrains Mono" fontWeight="500" fill="rgba(250,204,21,0.75)" data-testid="sun-sunrise-label">{`↑ ${srLabel}`}</text>
            <text x={CX + RX + 8} y={BASE - 2} textAnchor="start" fontSize="10" fontFamily="JetBrains Mono" fontWeight="500" fill="rgba(192,132,252,0.8)" data-testid="sun-sunset-label">{`${ssLabel} ↓`}</text>
            <text x={CX} y={BASE - RY - 12} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.35)">{noonLabel}</text>

            <text x={CX} y="82" textAnchor="middle" fontSize="34" fontFamily="JetBrains Mono" fontWeight="300" fill="#ffffff" data-testid="sun-rest-hours">
              {comma(restHours)}
              <tspan fontSize="14" fill="rgba(255,255,255,0.4)" dx="4">h</tspan>
            </text>
            <text x={CX} y="98" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.4)" letterSpacing="2.2">REST-SONNE HEUTE</text>

            {isDay ? <g data-testid="sun-marker-day">{sunGlyph(m.x, m.y)}</g> : <g data-testid="sun-marker-night">{moonGlyph(m.x, m.y)}</g>}

            {hz && (
              <g data-testid="phase-tooltip" style={{ pointerEvents: "none" }}>
                {(() => {
                  const txt = `${hz.label} · ${hhmm(new Date(hz.from).getTime())}–${hhmm(new Date(hz.to).getTime())}`;
                  const w = 26 + txt.length * 6.0;
                  return (
                    <>
                      <rect x={CX - w / 2} y={44} width={w} height={21} rx={6} fill="#090d16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                      <text x={CX} y={58} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="#ffffff" data-testid="phase-tooltip-text">{txt}</text>
                    </>
                  );
                })()}
              </g>
            )}
          </svg>
        ) : (
          <SunBar hasSun={hasSun} isDay={isDay} srMs={srMs} ssMs={ssMs} markerT={markerT} tMin={TMIN} tMax={TMAX}
            zones={zones} hz={hz} hover={hover} setHover={setHover} reduced={reduced}
            restHours={restHours} srLabel={srLabel} ssLabel={ssLabel} noonLabel={noonLabel} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 border-t border-white/[0.05]" data-testid="sun-legend">
        {[["#4338ca", "Astronom. Nacht"], ["#3b82f6", "Blaue Stunde"], ["#f59e0b", "Goldene Stunde"]].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/50">
            <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// Balken-Ansicht als HTML (bleibt auf dem Handy gut lesbar, Positionen in %)
function SunBar({ hasSun, isDay, srMs, ssMs, markerT, tMin, tMax, zones, hz, hover, setHover, reduced, restHours, srLabel, ssLabel, noonLabel }) {
  const pct = (t) => ((Math.max(tMin, Math.min(tMax, t)) - tMin) / (tMax - tMin || 1)) * 100;
  const at = (t) => ({ left: `${pct(t)}%` });
  const span = (a, b) => {
    const l = pct(Math.min(a, b));
    return { left: `${l}%`, width: `${Math.max(0, pct(Math.max(a, b)) - l)}%` };
  };
  const ticks = [];
  if (hasSun) {
    const first = new Date(srMs); first.setMinutes(0, 0, 0);
    let t0 = first.getTime(); if (t0 < srMs) t0 += H;
    for (let tMs = t0; tMs < ssMs; tMs += H) ticks.push((tMs - srMs) / (ssMs - srMs));
  }
  const label = "absolute top-full mt-3 -translate-x-1/2 inline-flex items-center gap-0.5 font-mono whitespace-nowrap";

  return (
    <div data-testid="sun-timeline-bar" className="py-1">
      <div className="text-center">
        <div className="font-mono text-3xl sm:text-4xl font-light text-white tracking-tight leading-none" data-testid="sun-rest-hours">
          {comma(restHours)}<span className="text-sm sm:text-base text-white/40 ml-1">h</span>
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40 mt-2">Rest-Sonne heute</div>
      </div>

      <div className="relative mx-2 sm:mx-10 mt-9 mb-10">
        {hz && (
          <div data-testid="phase-tooltip" className="absolute bottom-full mb-4 -translate-x-1/2 z-10 pointer-events-none whitespace-nowrap rounded-md border border-white/20 bg-[#090d16] px-2.5 py-1 font-mono text-[10px] text-white"
            style={{ left: `${Math.max(18, Math.min(82, (pct(hz.t0) + pct(hz.t1)) / 2))}%` }}>
            <span data-testid="phase-tooltip-text">{hz.label} · {hhmm(new Date(hz.from).getTime())}–{hhmm(new Date(hz.to).getTime())}</span>
          </div>
        )}

        <div className="relative h-2.5 rounded-full overflow-hidden bg-[#0b1222] ring-1 ring-inset ring-white/10">
          {hasSun && (
            <>
              <div className="absolute inset-y-0 opacity-55" style={{ ...span(0, 1), background: "linear-gradient(90deg, #f59e0b, #facc15, #f59e0b)" }} />
              {zones.map((z) => <div key={z.key} data-testid={`bar-${z.key}`} className="absolute inset-y-0 opacity-80" style={{ ...span(z.t0, z.t1), background: z.color }} />)}
              {isDay && <div className="absolute inset-y-0 bg-white/[0.12]" style={span(0, markerT)} />}
              {ticks.map((t) => <div key={t} className="absolute top-[2px] bottom-[2px] w-px bg-black/30" style={at(t)} />)}
            </>
          )}
        </div>

        {hasSun && (
          <>
            {zones.map((z) => (
              <div key={`hit-${z.key}`} data-testid={`hit-${z.key}`} className="absolute -top-2 -bottom-2 cursor-pointer" style={{ ...span(z.t0, z.t1), minWidth: 6 }}
                onMouseEnter={() => setHover(z.key)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === z.key ? null : z.key)} />
            ))}
            <div className="absolute -top-3 -bottom-3 border-l border-dashed border-white/25 pointer-events-none" style={at(markerT)} />
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={at(markerT)} data-testid={isDay ? "sun-marker-day" : "sun-marker-night"}>
              <span className={`absolute -inset-[5px] rounded-full border ${isDay ? "border-[#FDE047]/30" : "border-[#7DD3FC]/30"} ${isDay && !reduced ? "animate-pulse" : ""}`} />
              <span className={`relative block w-3 h-3 rounded-full overflow-hidden ${isDay ? "bg-[#FDE047]" : "bg-[#7DD3FC]"}`}>
                {!isDay && <span className="absolute w-[9px] h-[9px] rounded-full bg-[#070c18] -top-[2px] -right-[3px]" />}
              </span>
            </div>

            <div className={`${label} text-[10px] font-medium text-yellow-400/75`} style={at(0)} data-testid="sun-sunrise-label"><ArrowUp size={10} />{srLabel}</div>
            <div className={`${label} text-[9px] text-white/35`} style={at(0.5)}>{noonLabel}</div>
            <div className={`${label} text-[10px] font-medium text-purple-400/80`} style={at(1)} data-testid="sun-sunset-label">{ssLabel}<ArrowDown size={10} /></div>
          </>
        )}
      </div>
    </div>
  );
}
