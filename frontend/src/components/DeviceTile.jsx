import { useEffect } from "react";

/**
 * Gleich große Geräte-Kachel im Command-Center-Stil (Silber/Schwarz/Grau).
 * Aufbau: Akzentleiste · Kopf (Titel + optional Badge) · Hauptwert · Raster mit Detail-Zeilen.
 *
 * Props:
 *  - title:        Karten-Titel (String)
 *  - accent:       Akzentfarbe (Hex) für Leiste + Hauptwert-Glühen
 *  - icon:         Lucide-Icon-Komponente (optional)
 *  - badge:       React-Node (z.B. SourceBadge) rechts oben
 *  - hero:        { value, unit, sub } – großer Hauptwert oben
 *  - rows:        Array von { label, value, color? } – Detail-Zeilen (Grid 2 Spalten)
 *  - children:    optionaler Freiraum unterhalb (z.B. Tabellen/Sparkline)
 *  - testid
 */
export default function DeviceTile({ title, accent, icon: Icon, badge, hero, rows = [], children, testid, className = "", weight = 1 }) {
  return (
    <div
      className={`device-tile group ${className}`}
      data-testid={testid}
      style={{ flexGrow: weight, flexBasis: 0, minWidth: 0 }}
    >
      <div className="tile-accent" style={{ background: `linear-gradient(90deg, ${accent}, transparent 92%)`, boxShadow: `0 0 12px ${accent}99` }} />
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} strokeWidth={2.2} style={{ color: accent }} className="shrink-0" />}
          <span className="tile-stat truncate" style={{ color: "rgba(241,245,249,0.7)" }}>{title}</span>
        </div>
        {badge}
      </div>
      <div className="silver-divider opacity-60" />

      {/* Hero-Wert */}
      {hero && (
        <div className="px-4 pt-3">
          <div className="flex items-end gap-1.5">
            <span
              className="tile-value text-3xl"
              style={{ color: hero.color || "#f1f5f9", textShadow: `0 0 10px ${accent}55` }}
            >
              {hero.value}
            </span>
            {hero.unit && <span className="text-silver-dim text-xs mb-1">{hero.unit}</span>}
          </div>
          {hero.sub && <div className="font-mono text-[10px] text-silver-dim mt-1">{hero.sub}</div>}
        </div>
      )}

      {/* Detail-Raster */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2">
              <span className="tile-stat text-[10px]">{r.label}</span>
              <span className="tile-value text-sm" style={{ color: r.color ? r.color : "rgba(241,245,249,0.92)" }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Freiraum */}
      {children && <div className="px-4 pb-4 mt-auto">{children}</div>}
    </div>
  );
}
