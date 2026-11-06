/* Gemeinsame Konstanten & Helfer der Verlauf-Vorschau (Energie-Analyse). */
export const CH = {
  pv: { key: "PV", label: "PV", color: "#F59E0B" },
  house: { key: "Haus", label: "Haus", color: "#F43F5E" },
  battery: { key: "Akku", label: "Akku", color: "#22D3EE" },
  grid: { key: "Netz", label: "Netz", color: "#818CF8" },
};
export const EXPORT_COLOR = "#10B981";

export const RANGES = ["1h", "3h", "6h", "12h", "24h"];
export const BUCKET_MIN = { "1h": 1, "3h": 3, "6h": 5, "12h": 10, "24h": 15 };

export const CARD = "rounded-2xl border border-white/[0.08] bg-[#0b0f17]";
export const TICK = { fontSize: 10, fontFamily: "JetBrains Mono", fill: "#64748b" };
export const GRID_STROKE = "rgba(255,255,255,0.06)";

export const hhmm = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
export const tzLabel = () => {
  const off = -new Date().getTimezoneOffset() / 60;
  return `UTC${off >= 0 ? "+" : "−"}${Math.abs(off)}`;
};

// Mittelwerte je Zeit-Bucket (Abtastrate passt sich der Zeitspanne an)
export function bucketize(points, range) {
  const ms = BUCKET_MIN[range] * 60000;
  const map = new Map();
  const FIELDS = { pv: "pv_power", house: "house_power", battery: "battery_power", grid: "grid_power", soc: "battery_soc" };
  for (const p of points) {
    const k = Math.floor(new Date(p.ts).getTime() / ms) * ms;
    const b = map.get(k) || { t: k, sum: {}, n: {} };
    // Fehlende Messwerte (null/undefined) zählen nicht als 0 in den Mittelwert.
    for (const [ch, field] of Object.entries(FIELDS)) {
      const v = p[field];
      if (v === null || v === undefined || Number.isNaN(Number(v))) continue;
      b.sum[ch] = (b.sum[ch] || 0) + Number(v);
      b.n[ch] = (b.n[ch] || 0) + 1;
    }
    map.set(k, b);
  }
  const avg = (b, ch) => (b.n[ch] ? Math.round(b.sum[ch] / b.n[ch]) : null);
  const rows = [...map.values()].sort((a, b) => a.t - b.t).map((b) => ({
    t: b.t,
    PV: avg(b, "pv"),
    Haus: avg(b, "house"),
    Akku: avg(b, "battery"),
    Netz: avg(b, "grid"),
    SoC: avg(b, "soc"),
  }));
  // Datenlücken (Backend aus) nicht überbrücken: Leerpunkt einfügen → Kurve unterbrochen
  const out = [];
  rows.forEach((r, i) => {
    if (i > 0 && r.t - rows[i - 1].t > 2 * ms) out.push({ t: rows[i - 1].t + ms, PV: null, Haus: null, Akku: null, Netz: null, SoC: null });
    out.push(r);
  });
  return out;
}
