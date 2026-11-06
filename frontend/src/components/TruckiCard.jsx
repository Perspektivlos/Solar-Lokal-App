import { COLOR, formatNum, GlassCard, SourceBadge } from "./solar-ui";
import { BatteryCharging } from "lucide-react";

// Tri-State für Schalter: true → EIN, false → AUS, sonst UNBEKANNT.
const switchState = (v) =>
  v === true ? { text: "● EIN", cls: "text-emerald-300" }
  : v === false ? { text: "○ AUS", cls: "text-white/30" }
  : { text: "– UNBEKANNT", cls: "text-white/40" };

// Trucki2Shelly-Speicherkarte: SoC, VBAT, Setpoints, AC-Output/ZEPC.
export default function TruckiCard({ trucki, acOnly = false }) {
  const hasPower = trucki?.battery_power !== null && trucki?.battery_power !== undefined && trucki?.battery_power !== "" && Number.isFinite(Number(trucki.battery_power));
  const hasAcPower = Number.isFinite(Number(trucki?.ac_display_w));
  const power = acOnly && hasAcPower ? Number(trucki.ac_display_w) : hasPower ? Number(trucki.battery_power) : null;
  const powerText = (acOnly ? hasAcPower : hasPower) ? `${power > 0 ? "+" : power < 0 ? "−" : ""}${formatNum(Math.abs(power), 0)}` : "–";
  const hasSoc = trucki?.soc !== null && trucki?.soc !== undefined && trucki?.soc !== "" && Number.isFinite(Number(trucki.soc));
  const socText = hasSoc ? formatNum(trucki.soc, 0) : "–";
  const hasPeak = trucki?.max_power_w !== null && trucki?.max_power_w !== undefined && trucki?.max_power_w !== "" && Number.isFinite(Number(trucki.max_power_w)) && Number(trucki.max_power_w) > 0;
  const peak = hasPeak ? Number(trucki.max_power_w) : null;
  const state = power > 20 ? "Laden" : power < -20 ? "Entladen" : "Leerlauf";
  return (
    <GlassCard title={acOnly ? "Trucki2Shelly · AC-Regelgateway" : "Trucki2Shelly · Speicher"} accent={acOnly ? "#8B5CF6" : COLOR.battery} icon={BatteryCharging} badge={<SourceBadge data={trucki} />} testid="card-trucki" danger={!acOnly && trucki?.soc !== undefined && trucki.soc < 15}>
      <div className="space-y-3">
        <div className="text-center">
          <div className="font-sans text-[11px] font-semibold tracking-[0.16em] text-white/70">{acOnly ? "AC-Ausgang & Sollwert" : "Leistung & SoC"}</div>
          <div className="flex items-baseline justify-center gap-3 mt-1.5" data-testid="trucki-soc-vbat">
            <div className="font-mono text-2xl font-semibold tracking-tight leading-none text-cyan-300" data-testid="trucki-power">{powerText}<span className="ml-1 text-sm font-normal text-white/50">W</span></div>
            <div className="font-mono text-2xl font-semibold tracking-tight leading-none text-white" data-testid="trucki-soc">{acOnly ? formatNum(trucki?.target_w,0) : socText}<span className="ml-1 text-sm font-normal text-white/50">{acOnly ? "W Soll" : "%"}</span></div>
          </div>
          <div className="font-mono text-[10px] text-white/40 mt-2" data-testid="trucki-peak">SUN Nenn {hasPeak ? `${formatNum(peak, 0)} W` : "–"} · {acOnly ? (trucki?.online ? "AC online" : "AC offline") : state}</div>
        </div>
        {trucki.target_w !== undefined && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 font-mono text-[11px]">
            {!acOnly && <div className="text-center text-white/85"><span className="text-white/50">VBAT</span><br/><span className="text-sm">{formatNum(trucki.battery_voltage, 2)} V</span></div>}
            <div className="text-center text-white/85"><span className="text-white/50">TARGET</span><br/><span className="text-sm">{formatNum(trucki.target_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">MIN</span><br/><span className="text-sm">{formatNum(trucki.min_power_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">MAX</span><br/><span className="text-sm">{formatNum(trucki.max_power_w, 0)} W</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">TAG</span><br/><span className="text-sm" data-testid="trucki-yield-day">{formatNum(trucki.day_energy_kwh, 2)} kWh</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">GESAMT</span><br/><span className="text-sm" data-testid="trucki-yield-total">{formatNum(trucki.total_energy_kwh, 1)} kWh</span></div>
            <div className="text-center text-white/85"><span className="text-white/50">TEMP</span><br/><span className="text-sm">{formatNum(trucki.temperature, 0)} °C</span></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-center">
          <div className="font-mono text-xs text-white/70">AC-Output: <span className={switchState(trucki.ac_output).cls}>{switchState(trucki.ac_output).text}</span></div>
          <div className="font-mono text-xs text-white/70">ZEPC: <span className={switchState(trucki.zepc).cls}>{switchState(trucki.zepc).text}</span></div>
        </div>
      </div>
    </GlassCard>
  );
}
