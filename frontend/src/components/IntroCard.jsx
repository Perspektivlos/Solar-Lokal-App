import { useState } from "react";
import { ChevronDown, BookOpen } from "lucide-react";

/**
 * Collapsible info card displayed at the top of each tab.
 *
 * Props:
 *  - title: short tab name (e.g. "Dashboard")
 *  - subtitle: one-line summary
 *  - sections: array of { label, body }  — body can be string or JSX
 *  - defaultOpen: boolean
 *  - accent: CSS color for the icon glow / divider
 */
export default function IntroCard({ title, subtitle, sections = [], defaultOpen = false, accent = "#06B6D4", testid }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-strong" data-testid={testid || "intro-card"}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
        data-testid={`${testid || "intro-card"}-toggle`}
      >
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-md"
          style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
        >
          <BookOpen size={14} style={{ color: accent }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm tracking-tight text-white">{title}</div>
          <div className="font-mono text-[11px] text-white/55 truncate">{subtitle}</div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          {open ? "schließen" : "details"}
        </div>
        <ChevronDown
          size={16}
          className={`text-white/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {sections.map((s) => (
            <div key={s.label} data-testid={`intro-section-${s.label}`}>
              <div
                className="font-mono text-[10px] uppercase tracking-[0.22em] mb-1.5 pb-1 border-b"
                style={{ color: accent, borderColor: `${accent}33` }}
              >
                {s.label}
              </div>
              <div className="text-[13px] leading-relaxed text-white/75">{s.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
