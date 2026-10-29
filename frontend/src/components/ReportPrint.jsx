import { Printer, Sun, Moon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

// Druck/PDF über den Browser-Dialog; mode = "light" (druckerfreundlich) | "dark" (wie Bildschirm)
const printReport = (mode) => {
  const root = document.documentElement;
  root.dataset.print = mode;
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("reveal-in"));
  const page = document.createElement("style");
  page.textContent = `@page { size: A4; margin: ${mode === "dark" ? "0" : "14mm 12mm"}; }`;
  document.head.appendChild(page);
  const cleanup = () => {
    delete root.dataset.print;
    page.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 60);
};

const OPTIONS = [
  { mode: "light", icon: Sun, label: "Hell · druckerfreundlich", sub: "weißer Hintergrund, spart Tinte" },
  { mode: "dark", icon: Moon, label: "Dunkel · wie am Bildschirm", sub: "Leitstand-Design als PDF" },
];

export const ReportPrintButton = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" data-testid="report-print-btn"
        className="shrink-0 ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-200 hover:bg-cyan-400/20 transition-colors">
        <Printer size={14} /> <span className="hidden sm:inline">Drucken / PDF</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64 bg-[#0a1020] border-white/12 text-white" data-testid="report-print-menu">
      {OPTIONS.map((o) => (
        <DropdownMenuItem key={o.mode} data-testid={`report-print-${o.mode}`} onSelect={() => printReport(o.mode)}
          className="flex items-start gap-3 py-2.5 cursor-pointer focus:bg-white/5">
          <o.icon size={16} className="mt-0.5 text-cyan-300" />
          <span>
            <span className="block text-[13px] text-white">{o.label}</span>
            <span className="block text-[11px] text-white/45">{o.sub}</span>
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
