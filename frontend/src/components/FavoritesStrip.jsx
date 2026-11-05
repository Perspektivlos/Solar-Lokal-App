/* Favoriten-Leiste: kompakte KPI-Kacheln für angepinnte Elemente, ganz oben im
 * Dashboard. Unterstützt ganze Geräte (shelly/ahoy/trucki/victron) sowie einzelne
 * MPPT-Strings (mppt:<index>) und Shelly-Phasen (phase:<L1|L2|L3>).
 * Reihenfolge per Drag & Drop umsortierbar (nativ, persistiert über onReorder). */
import { useState } from "react";
import { Cable, Sun, BatteryCharging, Zap, Star, GripVertical } from "lucide-react";
import { COLOR, formatNum } from "./solar-ui";

// Liefert Anzeige-Metadaten + aktuellen KPI-Wert für einen Favoriten-Schlüssel,
// oder null wenn gerade keine Daten vorliegen.
function favItem(key, live) {
  const { shelly, ahoy, trucki, victron, summary } = live || {};
  if (key === "shelly") {
    const p = shelly?.total_power ?? 0;
    return { label: "Shelly · Netz", icon: Cable, color: p >= 0 ? COLOR.grid_imp : COLOR.grid_exp, value: formatNum(Math.abs(p), 0), unit: "W", sub: p >= 0 ? "Netzbezug" : "Einspeisung" };
  }
  if (key === "ahoy") {
    return { label: "Hoymiles · AC", icon: Zap, color: COLOR.pv, value: formatNum(ahoy?.total_power, 0), unit: "W", sub: `Limit ${formatNum(ahoy?.limit_percent, 0)} %` };
  }
  if (key === "trucki") {
    const bp = summary?.battery_power ?? 0;
    return { label: "Trucki · Akku", icon: BatteryCharging, color: COLOR.battery, value: formatNum(trucki?.soc, 0), unit: "%", sub: `${bp > 20 ? "Laden" : bp < -20 ? "Entladen" : "Leerlauf"} ${formatNum(Math.abs(bp), 0)} W` };
  }
  if (key === "victron") {
    const mppts = victron?.mppts || [];
    const pv = mppts.reduce((a, m) => a + (m.pv_power || 0), 0);
    const yld = mppts.reduce((a, m) => a + (m.yield_today || 0), 0);
    return { label: "Victron · PV", icon: Sun, color: COLOR.victron, value: formatNum(pv, 0), unit: "W", sub: `Ertrag ${formatNum(yld, 2)} kWh` };
  }
  if (key.startsWith("phase:")) {
    const ph = key.slice(6);
    const p = (shelly?.phases || []).find((x) => x.phase === ph);
    if (!p) return null;
    const pw = p.power ?? 0;
    return { label: `Shelly · ${ph}`, icon: Cable, color: pw >= 0 ? COLOR.grid_imp : COLOR.grid_exp, value: formatNum(Math.abs(pw), 0), unit: "W", sub: pw >= 0 ? "Bezug" : "Einspeisung" };
  }
  if (key.startsWith("mppt:")) {
    const idx = Number(key.slice(5));
    const m = (victron?.mppts || [])[idx];
    if (!m) return null;
    return { label: m.name || `MPPT #${idx + 1}`, icon: Sun, color: COLOR.pv_dc || "#F59E0B", value: formatNum(m.pv_power, 0), unit: "W", sub: `Ertrag ${formatNum(m.yield_today, 2)} kWh` };
  }
  return null;
}

const tid = (key) => key.replace(":", "-");

export function FavoritesStrip({ favorites, live, onToggle, onReorder }) {
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const keys = (favorites || []).filter((k) => favItem(k, live));
  if (keys.length === 0) return null;

  const handleDrop = (targetKey) => {
    if (dragKey && dragKey !== targetKey) {
      const arr = [...(favorites || [])];
      const from = arr.indexOf(dragKey);
      const to = arr.indexOf(targetKey);
      if (from > -1 && to > -1) {
        arr.splice(from, 1);
        arr.splice(to, 0, dragKey);
        onReorder?.(arr);
      }
    }
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <div data-testid="favorites-strip">
      <div className="flex items-center gap-2 mb-3">
        <Star size={13} strokeWidth={2.4} style={{ color: COLOR.pv }} fill={COLOR.pv} />
        <span className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-white/80">Favoriten</span>
        <span className="font-mono text-[10px] text-white/40">angepinnt · zum Sortieren ziehen</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {keys.map((key) => {
          const it = favItem(key, live);
          const Icon = it.icon;
          const isDragging = dragKey === key;
          const isOver = overKey === key && dragKey && dragKey !== key;
          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => { setDragKey(key); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnter={() => setOverKey(key)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => handleDrop(key)}
              onDragEnd={() => { setDragKey(null); setOverKey(null); }}
              data-testid={`favorite-tile-${tid(key)}`}
              className="relative rounded-xl px-4 py-3 overflow-hidden cursor-grab active:cursor-grabbing transition-all"
              style={{
                background: "linear-gradient(145deg, #0c1526 0%, #070c18 100%)",
                border: `1px solid ${isOver ? it.color : `${it.color}44`}`,
                boxShadow: `inset 0 1px 0 rgba(226,232,240,0.06), 0 18px 40px -28px #000, 0 0 22px -10px ${it.color}`,
                opacity: isDragging ? 0.45 : 1,
                transform: isOver ? "translateY(-2px)" : "none",
              }}
            >
              <span className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${it.color}, transparent 85%)`, boxShadow: `0 0 10px ${it.color}` }} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical size={13} className="text-white/25 shrink-0" />
                  <span className="grid place-items-center rounded-md shrink-0" style={{ width: 22, height: 22, background: `${it.color}1f`, border: `1px solid ${it.color}55` }}>
                    <Icon size={12} color={it.color} />
                  </span>
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 truncate">{it.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(key)}
                  onDragStart={(e) => e.preventDefault()}
                  title="Favorit entfernen"
                  data-testid={`favorite-unpin-${tid(key)}`}
                  className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                >
                  <Star size={12} style={{ color: it.color }} fill={it.color} />
                </button>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-dseg text-[1.5rem] leading-none" style={{ color: it.color, textShadow: `0 0 10px ${it.color}88` }}>{it.value}</span>
                <span className="font-mono text-[11px] text-white/40">{it.unit}</span>
              </div>
              <div className="font-mono text-[10px] text-white/45 mt-1.5">{it.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
