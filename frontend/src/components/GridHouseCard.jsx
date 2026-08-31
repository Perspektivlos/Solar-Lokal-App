import { COLOR, formatNum, GlassCard, Badge, MetricBig } from "./solar-ui";
import { Home } from "lucide-react";
import { exportNowW, isExporting } from "../lib/power";

/**
 * Zeigt die aktuelle Netzeinspeisung und den Haushaltsverbrauch an.
 * @param {Object} summary - Aktuelle Leistungswerte von Netz und Haushalt.
 * @param {Object} trail - Historische Werte für die Leistungsdiagramme.
 * @returns {JSX.Element} Die Karte mit Einspeisung, Verbrauch und Status.
 */
export default function GridHouseCard({ summary, trail }) {
  const exportNow = exportNowW(summary);
  const exporting = isExporting(summary);
  return (
    <GlassCard title="Einspeisung & Hausverbrauch" accent={COLOR.grid_exp} icon={Home} testid="card-grid-house" badge={<Badge kind={exporting ? "EXPORT" : "IMPORT"} />}>
      <MetricBig
        label="Einspeisung (Export)"
        value={formatNum(exportNow, 0)}
        unit="W"
        color="text-emerald-300 neon-text-green"
        sparkValues={trail.grid}
        sparkColor={COLOR.grid_exp}
      />
      <div className="mt-4 pt-4 border-t border-white/10">
        <MetricBig
          label="Hausverbrauch aktuell"
          value={formatNum(summary.house_power, 0)}
          unit="W"
          color="text-white"
          sparkValues={trail.house}
          sparkColor={COLOR.house}
        />
      </div>
    </GlassCard>
  );
}
