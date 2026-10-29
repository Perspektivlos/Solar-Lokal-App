# Roadmap bearbeiten & „Was ist neu?"

Die vorhandene Roadmap wird direkt in der App bearbeitbar und dauerhaft gespeichert.
Beim Versionssprung zeigt ein kurzes Fenster automatisch, was neu fertig geworden ist.

## Für wen

Für den Betreiber der eigenen Solaranlage, der die Roadmap selbst pflegen will – Punkte
hinzufügen, abhaken und zwischen „Erledigt / In Arbeit / Geplant" verschieben – und beim
Öffnen einer neuen App-Version sofort sehen möchte, was dazugekommen ist. Lokal, deutsch,
im bestehenden SCADA-Look.

## Kernfunktionen & Erlebnis

**1. Roadmap bearbeiten (gleicher Aufbau wie bisher)**
- Die Ansicht behält ihre drei Spalten **Erledigt / In Arbeit / Geplant** mit Farbcodes.
- Ein **Bearbeiten-Schalter**: Im Ansichtsmodus sieht alles aus wie heute; eingeschaltet
  erscheinen die Bearbeitungs-Elemente.
- Möglich sind: **Punkt hinzufügen** (Titel + Status + Datum/Phase), **Titel ändern**,
  **löschen** (mit kurzer Rückfrage), **Status ändern** (= „abhaken" / in andere Spalte) und
  **Reihenfolge ändern**.
- **Verschieben per Ziehen:** Ein Punkt in eine andere Spalte gezogen ändert seinen Status;
  innerhalb einer Spalte ändert Ziehen die Reihenfolge.
- Alle Änderungen werden **dauerhaft gespeichert** (bleiben nach Neuladen erhalten und gelten
  für jedes Gerät, das dieselbe lokale Installation nutzt).

**2. Startinhalt: alle Bau-Phasen vollständig vorbefüllt**
- Die Roadmap wird einmalig mit dem **kompletten, tatsächlichen Stand** gefüllt: alle bisher
  umgesetzten Bau-Phasen als „Erledigt", laufende als „In Arbeit" und alle bekannten offenen
  Punkte als „Geplant". Danach ist alles frei editierbar.

**3. „Was ist neu?"-Fenster beim Versionssprung**
- Erscheint **automatisch**, wenn die App-Version seit dem letzten Besuch gewechselt hat.
- Zeigt **automatisch alle Punkte, die seit dem letzten Besuch neu auf „Erledigt" stehen** –
  ohne manuelles Zuordnen.
- Ist **wegklickbar**; die Version gilt danach als „gesehen". Lässt sich jederzeit erneut
  über die Versionsnummer in der Fußleiste öffnen.
- Erscheint nicht, wenn seit dem letzten Besuch nichts fertig wurde.

## Nutzerfluss

1. Neue App-Version öffnen → „Was ist neu?" erscheint mit den frisch erledigten Punkten → wegklicken.
2. Über die Versionsnummer in der Fußleiste die Ansicht „Doku & Roadmap" öffnen.
3. Im Tab **Roadmap** den **Bearbeiten-Schalter** aktivieren.
4. Punkte hinzufügen, umbenennen, abhaken, zwischen den Spalten ziehen oder löschen.
5. Bearbeiten ausschalten → die Ansicht ist wieder aufgeräumt; Änderungen bleiben gespeichert.
6. Die Anleitung (zweiter Tab) bleibt unverändert zum Ansehen.

## UI/UX-Gefühl

Gleiche SCADA-Control-Room-Sprache: dunkler Hintergrund, Neon-Akzente, feine Rahmen,
Mono-/LCD-Typografie. Drei Status-Spalten mit klaren Farben (grün = erledigt, cyan = in Arbeit,
grau = geplant). Bearbeitungs-Elemente dezent und erst im Bearbeiten-Modus sichtbar.
Das „Was ist neu?"-Fenster ist ein schlankes, wegklickbares Overlay. Responsiv (Desktop wie
Mobil), deutsch.

## Umsetzungsphasen

**Phase 1 – MVP (wird jetzt gebaut):** Dauerhaft gespeicherte, bearbeitbare Roadmap im
bestehenden 3-Spalten-Aufbau (hinzufügen, umbenennen, löschen, Status/Abhaken, verschieben per
Ziehen), vollständig mit allen bisherigen Bau-Phasen vorbefüllt. Automatisches
„Was ist neu?"-Fenster beim Versionssprung mit den seit dem letzten Besuch neu erledigten
Punkten, wegklickbar und über die Versionsnummer erneut aufrufbar.

**Phase 2 – später:** Zusätzliche Felder je Punkt (Notiz, Link, geplantes Datum), Kategorien/Tags,
Suche/Filter sowie Vorlagen für häufige Einträge.

**Phase 3 – später:** „Erledigt"-Historie zusätzlich automatisch aus der Versionshistorie
ableiten; Roadmap/Änderungsliste als Druck-/PDF-Ansicht exportieren.

## Annahmen

- Die Roadmap wird **auf der lokalen Installation gespeichert** (nicht pro Browser): Änderungen
  gelten für alle, die dieselbe lokale App nutzen, und bleiben nach Neuladen erhalten.
- Es gibt **keinen Login**; wer Zugriff auf die lokale App hat, darf die Roadmap bearbeiten
  (lokaler Einzelbetrieb).
- **„Abhaken"** bedeutet: Status auf „Erledigt" setzen. **„Verschieben"** bedeutet: per Ziehen
  zwischen den Spalten (ändert den Status) bzw. innerhalb einer Spalte (ändert die Reihenfolge).
- Der **Aufbau bleibt wie bei der bestehenden Roadmap** (drei Status-Spalten mit Farbcodes);
  neu ist nur der editierbare, dauerhaft gespeicherte Inhalt und das Bearbeiten.
- Die **App-Versionsnummer** wird weiterhin bei der Auslieferung gesetzt und löst das
  „Was ist neu?"-Fenster aus. Das Fenster listet die **seit dem letzten Besuch neu erledigten**
  Punkte – unabhängig davon, welche Version sie erhalten haben.
- Das **Löschen** eines Punktes verlangt eine kurze Bestätigung, um versehentlichen Verlust zu
  vermeiden.
- Der **Startinhalt** wird aus dem tatsächlichen Projektstand zusammengestellt; danach zählt
  ausschließlich der in der App gepflegte Stand.
- Bearbeiten findet **in der vorhandenen Roadmap-Ansicht** statt (per Schalter); die Ansicht ist
  standardmäßig nur zum Lesen.
- Alles auf **Deutsch**, im bestehenden SCADA-Look. Entfernte Funktionen (Watt-Labels auf den
  Flusslinien, 48-h-Prognose, CSV-Export) bleiben entfernt. **Keine neuen externen Integrationen.**
