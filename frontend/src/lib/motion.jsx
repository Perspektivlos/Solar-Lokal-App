/* Zentrale Bewegungs-/Animations-Steuerung.
 * pref: "auto" (folgt System prefers-reduced-motion) · "off" (Animationen immer an)
 *       · "on" (Animationen reduziert). In localStorage persistiert.
 * reduced: effektiver Zustand, den Komponenten (EnergyFlow, SunTimeline) auswerten,
 *          um SVG-SMIL-Animationen zu überspringen (CSS allein erreicht SMIL nicht). */
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const KEY = "solar.motionPref";
const MotionCtx = createContext({ reduced: false, pref: "auto", setPref: () => {} });

const systemReduced = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export function MotionProvider({ children }) {
  const [pref, setPrefState] = useState(() => {
    try { return localStorage.getItem(KEY) || "auto"; } catch { return "auto"; }
  });
  const [system, setSystem] = useState(systemReduced);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setSystem(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const reduced = pref === "on" ? true : pref === "off" ? false : system;

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("reduce-motion", reduced);
    el.classList.toggle("motion-force-on", pref === "off");
  }, [reduced, pref]);

  const setPref = useCallback((p) => {
    setPrefState(p);
    try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
  }, []);

  return <MotionCtx.Provider value={{ reduced, pref, setPref }}>{children}</MotionCtx.Provider>;
}

export const useMotion = () => useContext(MotionCtx);
