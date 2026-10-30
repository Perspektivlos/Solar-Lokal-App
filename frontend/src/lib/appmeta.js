/* Zentrale Quelle für App-Version und Roadmap. EINZIGER Ort, der beim Ausliefern
 * neuer Funktionen gepflegt wird – Fußleiste und Doku/Roadmap-Ansicht lesen von hier.
 * Status je Punkt: "done" (Erledigt) · "wip" (In Arbeit) · "planned" (Geplant). */
export const APP_NAME = "HauckLab · Solar'Projekt";
export const APP_SYSTEM = ["Hoymiles HM-1500 + 2x Victron MPPT", "48V LiFePO4", "Shelly Pro 3EM"];
export const APP_VERSION = "1.6.0";
export const APP_LAST_UPDATED = "2026-10-29";

export const ROADMAP = [
  // --- Erledigt ---
  { status: "done", date: "2026-06", title: "Live-Dashboard mit animiertem Energiefluss" },
  { status: "done", date: "2026-06", title: "SCADA-Control-Room-Design (DSEG7-LCD, Sora, Neon-Akzente)" },
  { status: "done", date: "2026-06", title: "Geräte-Steuerung: Hoymiles-Limit & Trucki/SUN" },
  { status: "done", date: "2026-06", title: "Status-Alarme + konfigurierbare Schwellwerte" },
  { status: "done", date: "2026-06", title: "Diagnose / Geräte-Selbsttest" },
  { status: "done", date: "2026-06", title: "Geräte-Erkennung + Firmware-Vergleich" },
  { status: "done", date: "2026-06", title: "Integrationen: Mosquitto MQTT & InfluxDB" },
  { status: "done", date: "2026-06", title: "Lokaler Start ohne MongoDB + DB-Retention" },
  { status: "done", date: "2026-10", title: "Grafana Auto-Provisioning (Datasource + 42-Panel-Dashboard)" },
  { status: "done", date: "2026-10-07", title: "SCADAvis-Synoptik-Vorschau + Grafana-Panel" },
  { status: "done", date: "2026-10-07", title: "Sonnen-Tagesverlauf (Balken & Bogen umschaltbar)" },
  { status: "done", date: "2026-10-07", title: "Favoriten aufs Dashboard pinnen (inkl. MPPT-Strings & Phasen)" },
  { status: "done", date: "2026-10-07", title: "Favoriten per Drag-&-Drop sortieren" },
  { status: "done", date: "2026-10-29", title: "Vier große Geräte-KPI-Karten" },
  { status: "done", date: "2026-10-29", title: "Energiefluss: Kompakt (5) / Detail (6) / Auto" },
  { status: "done", date: "2026-10-29", title: "Fluss an/aus + Tempo-Regler (1× / 1.5× / 2×)" },
  { status: "done", date: "2026-10-29", title: "Hochkant-Energiefluss auf Mobilgeräten" },
  { status: "done", date: "2026-10-29", title: "Einstellungen: Akkukapazität & Karten-Beschriftungen" },

  // --- In Arbeit ---
  { status: "wip", date: "2026-10-29", title: "Versions-Fußleiste, In-App-Roadmap & Anleitung" },

  // --- Geplant ---
  { status: "planned", date: "Phase 2", title: "Mini-Sparklines (15-Min-Trend) in den Geräte-Karten" },
  { status: "planned", date: "Phase 2", title: "Roadmap direkt in der App bearbeiten & speichern" },
  { status: "planned", date: "Phase 2", title: "„Was ist neu?\"-Hinweis beim Versionssprung" },
  { status: "planned", date: "Phase 3", title: "Schwellwert-Farbalarme je Karte / Kachel" },
  { status: "planned", date: "Phase 3", title: "Akustische / Push-Benachrichtigung bei kritischen Alarmen" },
  { status: "planned", date: "Phase 3", title: "Erledigt-Historie aus der Versionshistorie ableiten" },
  { status: "planned", date: "Phase 3", title: "Anleitung als Druck- / PDF-Ansicht exportieren" },
  { status: "planned", date: "Phase 3", title: "Weitere Gerätetexte in den Einstellungen editierbar" },
  { status: "planned", date: "Phase 3", title: "Eigenes Synoptik-SVG final ins Grafana-Panel einhängen" },
];

export const ROADMAP_GROUPS = [
  { key: "done", title: "Erledigt", color: "#10B981" },
  { key: "wip", title: "In Arbeit", color: "#06B6D4" },
  { key: "planned", title: "Geplant", color: "#8C92AC" },
];
