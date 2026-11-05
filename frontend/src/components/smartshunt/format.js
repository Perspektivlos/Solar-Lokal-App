export const CYAN = "#06B6D4";

export const fmt = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const signed = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  const prefix = Number(value) > 0 ? "+" : "";
  return `${prefix}${fmt(value, digits)}`;
};

export const duration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return "–";
  const totalMinutes = Math.max(0, Math.round(Number(seconds) / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return days ? `${days} d ${hours} h` : `${hours} h ${minutes} min`;
};

export const clock = (iso) => iso
  ? new Date(iso).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" })
  : "–";

export const statusMeta = (status) => ({
  current: { label: "AKTUELL", color: "#10B981", className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  stale: { label: "VERALTET", color: "#F59E0B", className: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  unavailable: { label: "NICHT VERFÜGBAR", color: "#EF4444", className: "border-red-400/40 bg-red-400/10 text-red-300" },
}[status] || { label: "UNBEKANNT", color: "#94A3B8", className: "border-white/20 bg-white/5 text-white/55" });

export const testKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const COUNTERS = [
  ["charged_energy_kwh", "Geladene Energie", "kWh", 1],
  ["discharged_energy_kwh", "Entladene Energie", "kWh", 1],
  ["charge_cycles", "Ladezyklen", "", 0],
  ["total_ah_drawn", "Entnommene Ah gesamt", "Ah", 1],
  ["deepest_discharge_ah", "Tiefste Entladung", "Ah", 1],
  ["last_discharge_ah", "Letzte Entladung", "Ah", 1],
  ["average_discharge_ah", "Mittlere Entladung", "Ah", 1],
  ["minimum_voltage_v", "Minimale Spannung", "V", 2],
  ["maximum_voltage_v", "Maximale Spannung", "V", 2],
  ["time_since_full_charge_s", "Seit letzter Vollladung", "", 0],
  ["automatic_syncs", "Automatische Syncs", "", 0],
  ["low_voltage_alarms", "Unterspannungsalarme", "", 0],
  ["high_voltage_alarms", "Überspannungsalarme", "", 0],
];

export const OPTIONAL = [
  ["midpoint_voltage_v", "Mittelpunktspannung", "V", 2],
  ["midpoint_deviation_pct", "Mittelpunktabweichung", "%", 2],
  ["temperature_c", "Temperatur", "°C", 1],
  ["starter_voltage_v", "Starterspannung", "V", 2],
];