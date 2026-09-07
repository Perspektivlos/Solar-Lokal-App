import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Map, CheckCircle2, Clock, Lightbulb } from "lucide-react";

const SECTIONS = [
  {
    key: "done",
    title: "Erledigt",
    Icon: CheckCircle2,
    color: "#10B981",
    items: [
      "Live-Dashboard mit animiertem Energiefluss",
      "Verlauf, Steuerung (Hoymiles / Trucki), Geräte & Diagnose",
      "Integrationen: Mosquitto MQTT & InfluxDB",
      "DB-Retention – automatische Bereinigung alter Snapshots",
      "Lokaler In-Memory-Start ohne MongoDB (VS Code)",
      "Energiefluss: fließende Partikel & watt-abhängiges Tempo",
    ],
  },
  {
    key: "planned",
    title: "Geplant",
    Icon: Clock,
    color: "#06B6D4",
    items: [
      "Alarm-Schwellwerte – Warnungen bei Über-/Unterspannung & Strom",
      "Geräte-Favoriten – wichtige KPIs oben anpinnen",
    ],
  },
  {
    key: "ideas",
    title: "Ideen",
    Icon: Lightbulb,
    color: "#FACC15",
    items: [
      "Push-Benachrichtigungen bei Ereignissen",
      "Historien-Vergleich Tag / Woche / Monat",
    ],
  },
];

export default function RoadmapDialog({ children }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="footer-version"
          className="text-silver/70 hover:text-cyan-300 transition-colors cursor-pointer underline decoration-dotted decoration-white/20 underline-offset-4"
          title="Roadmap anzeigen"
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent
        data-testid="roadmap-dialog"
        className="glass-strong border border-white/10 text-white max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.2em] text-white/85">
            <Map size={16} className="text-cyan-400 neon-cyan" />
            Roadmap
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2 max-h-[65vh] overflow-y-auto pr-1">
          {SECTIONS.map(({ key, title, Icon, color, items }) => (
            <div key={key} data-testid={`roadmap-section-${key}`}>
              <div
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] mb-2"
                style={{ color }}
              >
                <Icon size={13} />
                {title}
              </div>
              <ul className="space-y-1.5">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[13px] text-white/75 leading-snug"
                  >
                    <span
                      className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                    />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
