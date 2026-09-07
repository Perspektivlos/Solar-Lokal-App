/* Globales Status-/Alarm-Banner für das Dashboard (SCADA-Stil). */
import { TriangleAlert, ShieldCheck, AlertOctagon } from "lucide-react";

export default function StatusBanner({ alarms }) {
  const list = Array.isArray(alarms) ? alarms : [];
  const critical = list.filter((a) => a.severity === "critical");
  const warning = list.filter((a) => a.severity === "warning");

  if (list.length === 0) {
    return (
      <div
        data-testid="status-banner-ok"
        className="flex items-center gap-2.5 rounded border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-2.5"
      >
        <ShieldCheck size={15} className="text-emerald-400" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">
          Alle Systeme im Normalbereich
        </span>
      </div>
    );
  }

  const ordered = [...critical, ...warning];
  const level = critical.length ? "critical" : "warning";
  const HeaderIcon = level === "critical" ? AlertOctagon : TriangleAlert;

  return (
    <div
      data-testid="status-banner"
      data-level={level}
      className={`rounded border px-4 py-3 ${
        level === "critical"
          ? "border-red-400/45 bg-red-500/[0.08]"
          : "border-orange-400/45 bg-orange-500/[0.07]"
      }`}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <HeaderIcon
          size={16}
          className={`${level === "critical" ? "text-red-400 animate-pulse" : "text-orange-400"}`}
        />
        <span
          className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${
            level === "critical" ? "text-red-300" : "text-orange-300"
          }`}
        >
          {critical.length > 0 && `${critical.length} kritisch`}
          {critical.length > 0 && warning.length > 0 && " · "}
          {warning.length > 0 && `${warning.length} Warnung${warning.length > 1 ? "en" : ""}`}
        </span>
      </div>
      <ul className="space-y-1.5">
        {ordered.map((a) => {
          const isCrit = a.severity === "critical";
          return (
            <li
              key={a.id}
              data-testid={`alarm-${a.id}`}
              className="flex items-start gap-2.5 text-[13px] leading-snug"
            >
              <span
                className={`mt-[6px] w-1.5 h-1.5 rounded-full shrink-0 ${isCrit ? "bg-red-400" : "bg-orange-400"}`}
                style={{ boxShadow: `0 0 6px ${isCrit ? "#f87171" : "#fb923c"}` }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/45 min-w-[130px] pt-[1px]">
                {a.device_label}
              </span>
              <span className={isCrit ? "text-red-200/90" : "text-orange-200/90"}>{a.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
