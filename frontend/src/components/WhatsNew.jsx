/* „Was ist neu?"-Overlay: erscheint beim Versionssprung und listet die seit dem
 * letzten Besuch neu auf „Erledigt" gesetzten Roadmap-Punkte. Wegklickbar. */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Sparkles, CircleCheck } from "lucide-react";
import { APP_VERSION } from "../lib/appmeta";

export default function WhatsNew({ open, items, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent data-testid="whatsnew-dialog" className="glass-strong border border-cyan-400/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-sans text-sm uppercase tracking-[0.2em] text-white/85">
            <Sparkles size={16} className="text-cyan-400 neon-cyan" />
            Was ist neu? <span className="font-mono text-[11px] text-cyan-300 normal-case tracking-normal">v{APP_VERSION}</span>
          </DialogTitle>
        </DialogHeader>
        <p className="text-white/55 text-[12px] -mt-1">Seit deinem letzten Besuch neu fertiggestellt:</p>
        <ul className="space-y-2 mt-1 max-h-[55vh] overflow-y-auto pr-1" data-testid="whatsnew-list">
          {(items || []).length === 0 && (
            <li className="text-white/50 text-[13px]">Keine neuen Punkte seit deinem letzten Besuch.</li>
          )}
          {(items || []).map((it) => (
            <li key={it.id} className="flex items-start gap-2.5" data-testid="whatsnew-item">
              <CircleCheck size={15} className="mt-[1px] shrink-0" style={{ color: "#10B981" }} />
              <div className="min-w-0">
                <div className="text-[13px] text-white/85 leading-snug">{it.title}</div>
                {it.date && <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/35 mt-0.5">{it.date}</div>}
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} data-testid="whatsnew-close"
          className="mt-3 w-full px-4 py-2 rounded font-mono text-xs uppercase tracking-[0.14em] text-slate-900 font-semibold"
          style={{ background: "linear-gradient(180deg, #67e8f9, #06B6D4)", boxShadow: "0 0 12px rgba(6,182,212,0.4)" }}>
          Verstanden
        </button>
      </DialogContent>
    </Dialog>
  );
}
