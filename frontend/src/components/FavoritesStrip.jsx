/* Favoriten-Leiste: kompakte KPI-Kacheln für angepinnte Geräte, ganz oben im
 * Dashboard. Werte kommen live aus dem /api/live-Payload. */
import { Cable, Sun, BatteryCharging, Zap, Star } from "lucide-react";
import { COLOR, formatNum } from "./solar-ui";

const FAV_META = {
  shelly: { label: "Shelly · Netz", icon: Cable, color: COLOR.grid_imp },
  ahoy: { label: "Hoymiles · AC", icon: Zap, color: COLOR.pv },
  trucki: { label: "Trucki · Akku", icon: BatteryCharging, color: COLOR.battery },
  victron: { label: "Victron · PV", icon: Sun, color: COLOR.victron },
};

function kpiFor(key, live) {
  const { shelly, ahoy, trucki, victron, summary } = live;
  if (key === "shelly") {
    const p = shelly?.total_power ?? 0;
    return { value: formatNum(Math.abs(p), 0), unit: "W", color: p >= 0 ? COLOR.grid_imp : COLOR.grid_exp, sub: p >= 0 ? "Netzbezug" : "Einspeisung" };
  }
  if (key === "ahoy") {
    return { value: formatNum(ahoy?.total_power, 0), unit: "W", color: COLOR.pv, sub: `Limit ${formatNum(ahoy?.limit_percent, 0)} %` };
  }
  if (key === "trucki") {
    const bp = summary?.battery_power ?? 0;
    return { value: formatNum(trucki?.soc, 0), unit: "%", color: COLOR.battery, sub: `${bp > 20 ? "Laden" : bp < -20 ? "Entladen" : "Leerlauf"} ${formatNum(Math.abs(bp), 0)} W` };
  }
  if (key === "victron") {
    const mppts = victron?.mppts || [];
    const pv = mppts.reduce((a, m) => a + (m.pv_power || 0), 0);
    const yld = mppts.reduce((a, m) => a + (m.yield_today || 0), 0);
    return { value: formatNum(pv, 0), unit: "W", color: COLOR.victron, sub: `Ertrag ${formatNum(yld, 2)} kWh` };
  }
  return { value: "–", unit: "", color: "#64748b", sub: "" };
}

export function FavoritesStrip({ favorites, live, onToggle }) {
  const keys = (favorites || []).filter((k) => FAV_META[k]);
  if (keys.length === 0) return null;
  return (
    <div data-testid="favorites-strip">
      <div className="flex items-center gap-2 mb-3">
        <Star size={13} strokeWidth={2.4} style={{ color: COLOR.pv }} fill={COLOR.pv} />
        <span className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-white/80">Favoriten</span>
        <span className="font-mono text-[10px] text-white/40">angepinnte Geräte</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {keys.map((key) => {
          const meta = FAV_META[key];
          const k = kpiFor(key, live);
          const Icon = meta.icon;
          return (
            <div
              key={key}
              data-testid={`favorite-tile-${key}`}
              className="relative rounded-xl px-4 py-3 overflow-hidden group"
              style={{
                background: "linear-gradient(145deg, #0c1526 0%, #070c18 100%)",
                border: `1px solid ${meta.color}44`,
                boxShadow: `inset 0 1px 0 rgba(226,232,240,0.06), 0 18px 40px -28px #000, 0 0 22px -10px ${meta.color}`,
              }}
            >
              <span className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${meta.color}, transparent 85%)`, boxShadow: `0 0 10px ${meta.color}` }} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid place-items-center rounded-md shrink-0" style={{ width: 22, height: 22, background: `${meta.color}1f`, border: `1px solid ${meta.color}55` }}>
                    <Icon size={12} color={meta.color} />
                  </span>
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 truncate">{meta.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(key)}
                  title="Favorit entfernen"
                  data-testid={`favorite-unpin-${key}`}
                  className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                >
                  <Star size={12} style={{ color: meta.color }} fill={meta.color} />
                </button>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-dseg text-[1.5rem] leading-none" style={{ color: meta.color, textShadow: `0 0 10px ${meta.color}88` }}>{k.value}</span>
                <span className="font-mono text-[11px] text-white/40">{k.unit}</span>
              </div>
              <div className="font-mono text-[10px] text-white/45 mt-1.5">{k.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
