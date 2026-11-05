// Physische PV-Konfiguration je Victron-MPPT (vom Nutzer angegeben):
// MPPT 1 = 4× 425 Wp, MPPT 2 = 4× 445 Wp (je 1 String).
export const MPPT_ARRAY = [
  { panels: 4, wp: 425 },
  { panels: 4, wp: 445 },
];

// String-Peak in Watt / kWp.
export const mpptPeakW = (i) => (MPPT_ARRAY[i] ? MPPT_ARRAY[i].panels * MPPT_ARRAY[i].wp : 0);
export const mpptPeakKwp = (i) => mpptPeakW(i) / 1000;

// HM-1500 Nennleistung laut Gerätemodell; später über die Geräte-Settings editierbar.
export const HOYMILES_NOMINAL_W = 1500;
export const VICTRON_PEAK_W = MPPT_ARRAY.reduce((sum, _, i) => sum + mpptPeakW(i), 0);
export const SYSTEM_PV_PEAK_W = HOYMILES_NOMINAL_W + VICTRON_PEAK_W;

export const utilizationPercent = (power, peak) => {
  if (power === null || power === undefined || power === "" || peak === null || peak === undefined || peak === "") return null;
  const p = Number(power);
  const max = Number(peak);
  if (!Number.isFinite(p) || !Number.isFinite(max) || max <= 0) return null;
  return Math.max(0, Math.min(100, (Math.abs(p) / max) * 100));
};
