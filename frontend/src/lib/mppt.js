// Physische PV-Konfiguration je Victron-MPPT (vom Nutzer angegeben):
// MPPT 1 = 4× 425 Wp, MPPT 2 = 4× 445 Wp (je 1 String).
export const MPPT_ARRAY = [
  { panels: 4, wp: 425 },
  { panels: 4, wp: 445 },
];

// String-Peak in Watt / kWp.
export const mpptPeakW = (i) => (MPPT_ARRAY[i] ? MPPT_ARRAY[i].panels * MPPT_ARRAY[i].wp : 0);
export const mpptPeakKwp = (i) => mpptPeakW(i) / 1000;
