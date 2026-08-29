// Kleine, wiederverwendbare Ableitungen aus der Live-Summary.
export const exportNowW = (summary) => Math.max(0, -(summary?.grid_power || 0));
export const isExporting = (summary) => (summary?.grid_power || 0) < 0;
