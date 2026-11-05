import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { COLOR, Spark } from "../components/solar-ui";

// Reine Design-Vorschau (nicht live, keine echten Daten) für den
// Digital-Readout-Look der KPI-Kacheln + Schrift-Vergleich.

const DEMO = [
  { label: "PV Gesamt", value: "14,94", unit: "kWh", accent: COLOR.pv, spark: [8, 9, 11, 10, 12, 13, 12, 14, 15, 14, 15], },
  { label: "PV Aktuell", value: "1.492", unit: "W", accent: COLOR.pv, spark: [900, 1100, 1300, 1250, 1400, 1480, 1450, 1500, 1492], },
  { label: "Netz Bezug (Gesamt)", value: "0,02", unit: "kWh", accent: COLOR.grid_imp, spark: [0.1, 0.05, 0.08, 0.03, 0.04, 0.02, 0.03, 0.02], },
  { label: "Netz Einspeisung (Aktuell)", value: "224", unit: "W", accent: COLOR.grid_exp, spark: [120, 180, 150, 210, 240, 200, 224], },
  { label: "Verbrauch (Gesamt)", value: "2,78", unit: "kWh", accent: COLOR.house, spark: [1.2, 1.6, 2.0, 2.2, 2.5, 2.6, 2.78], },
  { label: "Einspeisung (Gesamt)", value: "5,37", unit: "kWh", accent: COLOR.grid_exp, spark: [2, 2.8, 3.5, 4.1, 4.6, 5.0, 5.37], },
];

const FONT_OPTS = [
  { v: "dseg", l: "DSEG7 · LCD", cls: "font-dseg", note: "Echte 7-Segment-LCD-Optik (mit Geister-Ziffern)" },
  { v: "orbitron", l: "Orbitron", cls: "font-orbitron", note: "Geometrisch-digital, modern & klar" },
  { v: "techmono", l: "Share Tech Mono", cls: "font-techmono", note: "Technisches Monospace, dezent" },
  { v: "jet", l: "JetBrains (aktuell)", cls: "font-mono", note: "Aktuelle Schrift zum Vergleich" },
];

const ghostOf = (val) => val.replace(/[0-9]/g, "8");

function ReadoutTile({ m, font }) {
  const fontCls = FONT_OPTS.find((f) => f.v === font)?.cls || "font-mono";
  const showGhost = font === "dseg";
  return (
    <div
      className="relative rounded-xl p-5 overflow-hidden"
      data-testid={`preview-tile-${m.label}`}
      style={{
        background: "linear-gradient(145deg, #0b1424 0%, #060a15 100%)",
        border: "1px solid rgba(148,163,184,0.16)",
        boxShadow: "inset 0 1px 0 rgba(226,232,240,0.07), 0 24px 48px -28px #000",
      }}
    >
      <span className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${m.accent}, transparent 85%)`, boxShadow: `0 0 12px ${m.accent}, 0 1px 6px ${m.accent}aa` }} />
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{m.label}</div>

      {/* Eingelassenes LCD-Panel */}
      <div className="relative mt-3 rounded-lg px-3.5 pt-3 pb-2.5"
        style={{ background: "rgba(2,6,14,0.82)", border: "1px solid rgba(148,163,184,0.10)", boxShadow: "inset 0 2px 16px rgba(0,0,0,0.85), inset 0 0 1px rgba(226,232,240,0.12)" }}>
        <div className="relative leading-none" style={{ height: "2.6rem" }}>
          {showGhost && (
            <span className={`${fontCls} absolute inset-0 text-[2.6rem] leading-none select-none`}
              style={{ color: m.accent, opacity: 0.06 }} aria-hidden>
              {ghostOf(m.value)}
            </span>
          )}
          <span className={`${fontCls} relative text-[2.6rem] leading-none`}
            style={{ color: m.accent, textShadow: `0 0 14px ${m.accent}88, 0 0 2px ${m.accent}` }}>
            {m.value}
          </span>
          <span className="font-mono text-sm ml-2 text-white/40 align-top">{m.unit}</span>
        </div>
      </div>

      {m.spark && <div className="mt-3"><Spark values={m.spark} color={m.accent} height={22} /></div>}
    </div>
  );
}

const GENERAL_FONTS = [
  { l: "Space Grotesk", cls: "font-space" },
  { l: "Sora", cls: "font-sora" },
  { l: "IBM Plex Sans (aktuell)", cls: "font-sans" },
];

export default function KpiPreview() {
  const [font, setFont] = useState("dseg");
  const active = FONT_OPTS.find((f) => f.v === font);

  return (
    <div className="min-h-screen px-5 sm:px-8 py-8 max-w-[1400px] mx-auto" data-testid="kpi-preview-page">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200 transition-colors" data-testid="preview-back">
            <ArrowLeft size={13} /> Zurück zum Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-3 flex items-center gap-3">
            <span className="w-1.5 h-7 rounded-sm" style={{ background: COLOR.pv, boxShadow: `0 0 10px ${COLOR.pv}aa` }} />
            KPI Digital-Readout · Vorschau
          </h1>
          <p className="text-white/55 text-sm mt-1.5 max-w-2xl">
            Design-Vorschau (keine Live-Daten). Nur die Zahlen in Digital-/Segment-Optik, eingelassen in ein gerahmtes LCD-Panel. Wähle eine Schrift und sag mir, welche dir am besten gefällt.
          </p>
        </div>
      </div>

      {/* Schrift-Auswahl */}
      <div className="flex flex-wrap items-center gap-2 mt-5 mb-3">
        {FONT_OPTS.map((f) => (
          <button key={f.v} type="button" onClick={() => setFont(f.v)}
            data-testid={`preview-font-${f.v}`}
            className={`px-4 py-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors ${font === f.v ? "bg-cyan-400/20 text-cyan-200 border-cyan-400/40" : "text-white/55 border-white/12 hover:text-white hover:bg-white/5"}`}>
            {f.l}
          </button>
        ))}
      </div>
      <div className="font-mono text-[11px] text-white/45 mb-6">{active?.note}</div>

      {/* Die 6 KPI-Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO.map((m) => <ReadoutTile key={m.label} m={m} font={font} />)}
      </div>

      {/* Allgemeine Schrift testen */}
      <h2 className="text-lg font-semibold text-white mt-12 mb-1 flex items-center gap-3">
        <span className="w-1.5 h-6 rounded-sm" style={{ background: "#06B6D4", boxShadow: "0 0 10px #06B6D4aa" }} />
        Allgemeine Schrift · edel & modern
      </h2>
      <p className="text-white/50 text-sm mb-5 max-w-2xl">Zum Vergleich: wie sich Überschriften & Fließtext mit einer klareren, moderneren Schrift anfühlen.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GENERAL_FONTS.map((g) => (
          <div key={g.l} className="rounded-xl p-5" data-testid={`preview-genfont-${g.l}`}
            style={{ background: "rgba(13,19,33,0.7)", border: "1px solid rgba(148,163,184,0.14)" }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 mb-3">{g.l}</div>
            <div className={`${g.cls} text-white`}>
              <div className="text-2xl font-semibold tracking-tight">Solar · Live</div>
              <div className="text-base mt-2 text-white/80">Energiefluss & Anlagensteuerung</div>
              <p className="text-sm mt-3 text-white/60 leading-relaxed">
                Hoymiles, Victron MPPT und Trucki im Blick. Die Module liefern aktuell 1.492 W bei 94,7 V – der Akku lädt mit 70 %.
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="h-12" />
    </div>
  );
}
