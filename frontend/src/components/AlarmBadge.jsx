/* Kompaktes Alarm-Badge für den Dashboard-Header. Verlinkt zur Diagnose-Seite,
   wo das vollständige Status-Banner mit allen Details steht. */
import { Link } from "react-router-dom";
import { ShieldCheck, TriangleAlert, AlertOctagon } from "lucide-react";

export default function AlarmBadge({ alarms }) {
  const list = Array.isArray(alarms) ? alarms : [];
  const crit = list.filter((a) => a.severity === "critical").length;
  const warn = list.filter((a) => a.severity === "warning").length;
  const level = crit ? "critical" : warn ? "warning" : "ok";

  const cfg = {
    ok: { cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300", Icon: ShieldCheck, label: "System OK" },
    warning: { cls: "border-orange-400/45 bg-orange-400/10 text-orange-300", Icon: TriangleAlert, label: `${warn} Warnung${warn > 1 ? "en" : ""}` },
    critical: { cls: "border-red-400/50 bg-red-400/15 text-red-300", Icon: AlertOctagon, label: `${crit} kritisch${warn ? ` · ${warn} Warn.` : ""}` },
  }[level];
  const Icon = cfg.Icon;

  return (
    <Link
      to="/diagnose"
      data-testid="dashboard-alarm-badge"
      data-level={level}
      title={level === "ok" ? "Keine aktiven Alarme · zur Diagnose" : "Details auf der Diagnose-Seite"}
      className={`inline-flex items-center gap-1.5 border ${cfg.cls} px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.16em] font-semibold hover:brightness-125 transition-all`}
    >
      <Icon size={12} className={level === "critical" ? "animate-pulse" : ""} />
      {cfg.label}
    </Link>
  );
}
