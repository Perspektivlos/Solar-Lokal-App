# Wissensspeicher – HauckLab · Solar'Projekt

Gesammelte Erkenntnisse für künftige Sessions (vom Nutzer ausdrücklich gewünscht: „Speichere dein Wissen für dich …").

## Nutzer & Zusammenarbeit
- Sprache: ausschließlich Deutsch, kurz und klar; Nutzer arbeitet viel mit visuellen Edits (Kommentar an einem Element).
- Visuelle Edits oft mehrdeutig („verschiebe es …", „fehl platziert") → kurz per Rückfrage klären (2–3 Optionen), dann direkt umsetzen.
- Nutzer mag ausgewogene, symmetrische Layouts: gleiche Randabstände, nichts „in die Ecke gepresst", gleiche Abstände zwischen Reihen.
- Stilrichtung zuletzt: „schlicht und reduziert" – weniger Glow, mehr Luft, ruhige Typografie, Fokus auf das Wesentliche.
- Abgelehnt (NIE wieder vorschlagen): 48h-PV-Prognose, Watt-Labels auf Energiefluss-Linien, CSV-Export.
- Kein Login (lokales Heimnetz). Demo-Modus Standard.

## Seitenaufbau (Stand 30.10.2026)
- Dashboard: Geräte-Karten → Energiefluss → Kennzahlen. (Tagesverlauf NICHT mehr hier.)
- Verlauf: Charts → Energiebilanz → Tagesverlauf (SunTimeline, lädt eigenes `getLive()` alle 60 s). Alarm-Historie hier entfernt.
- Diagnose: Überblick → StatusBanner → Titel + Selbst-Test-Knopf → Geräte-Details-Leiste → Selbst-Test-Kachel → Rohdaten → Alarm-Historie.
- Doku (`/doku`): Roadmap (editierbar) + Anleitung + Link „Projektbericht".
- Bericht (`/bericht`, `/report-preview`): „Hinzugefügt" + Zeitachse automatisch aus Roadmap; Druck/PDF hell & dunkel.

- Geräte: Kartentexte + nutzbare Akku-kWh stehen in der jeweiligen Gerätekachel (keine eigene „Anlage & Anzeige"-Kachel mehr – vom Nutzer verworfen).
- Akku: „6× Power Queen 100 Ah", Spannung ~51,6 V (48-V-System). Nutzbare kWh in der App = 9,6 (Platzhalter!). Echte Kapazität hängt von der Modulspannung ab – beim Nutzer nachfragen, nicht raten.

## Energiefluss-Geometrie (EnergyFlow.jsx, Landscape viewBox 1060×420, Knoten 205×82)
- Detail: Hoymiles (130,72) + Victron (365,72) nebeneinander oben links; Netz (160,315); Haus (530,250); Batterie (900,105); Sun-2000 (900,315).
- Kompakt: PV (130,72); restliche wie Detail.
- Mobil-Hochformat (viewBox 480×640): PV (118,75) / Batterie (362,75); Haus (240,320); Netz (118,565) / Sun-2000 (362,565).
- Kanten sind gerade Linien Mitte→Mitte (`edge()`): beim Umstellen prüfen, dass Linien keine anderen Knoten schneiden.

## Technische Stolpersteine
- Shell-Edits per python/heredoc in /app können gelegentlich blockiert sein → `search_replace`/`create_file` nutzen.
- Externe URL-Aufrufe aus Python (urllib) liefern 403 (Bot-Schutz) → für Daten-Pflege `http://localhost:8001/api/...` nutzen.
- Roadmap-PUT speichert nur id/title/status/date (kein completed_at).
- Print-CSS: Tailwind-Opazitätsklassen per escaped Selektor überschreiben (`.text-white\/50`); `print-color-adjust: exact` für dunkles PDF.
- Recharts-Tooltip-Wrapper tauchen in Overflow-Checks auf – kein echter Seiten-Overflow.
- SVG-`<text>` mit Pfeil + Ziffern direkt hintereinander („↑06:06") rendert in Chromium nur den Pfeil (Ziffern Breite 0) → Leerzeichen dazwischen oder HTML + lucide-Icons verwenden.
- Feine SVG-Texte (viewBox 600 breit) werden auf dem Handy winzig → lesbare Werte/Labels lieber als HTML mit %-Positionen (siehe `SunBar` in SunTimeline.jsx).

## Ideen für später
- Erledigt-Datum beim Abhaken automatisch setzen (Zeitachse wird genauer).
- Notizen/Beschreibung je Roadmap-Punkt → fließt in Bericht.
- Doku/Anleitung ebenfalls druckbar.
- Alarm-Ton bei kritischen Alarmen.
- Selbst-Test-Verlauf speichern.
