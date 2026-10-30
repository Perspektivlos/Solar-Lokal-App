# Verlauf-Vorschau: Energie-Analyse mit Multilinie, 4 Kanälen und erweiterter Tagesbilanz

Eine eigene Vorschau-Seite zeigt die neu gestaltete Verlauf-Seite genau nach den vorgegebenen Bildern: eine neue Titelleiste mit Ansichts- und Zeitumschaltern, ein überarbeitetes Leistungsdiagramm mit ausblendbaren Kurven, vier Einzeldiagramme und eine stark erweiterte Tages-Energiebilanz in kWh.
Die jetzige Verlauf-Seite bleibt unverändert, bis die Vorschau freigegeben ist.

## Für wen
Für den Anlagenbetreiber (HauckLab · Solar'Projekt). Er will den Leistungsverlauf von PV, Haus, Akku und Netz auf einen Blick vergleichen, Kurven gezielt ein- und ausblenden und die Tagesbilanz vollständig nachvollziehen – am Desktop und am Handy.

## Kernfunktionen und Erlebnis

### 1. Titelleiste
- Titel **„Energie-Analyse & Recharts Zeitverlauf"** mit grünem Badge **„Live Synchron"**.
- Umschalter für die Ansicht: **„Multilinie (Option 1)"** | **„4 Kanäle (Option 2)"**.
- Zeitauswahl: **1H · 3H · 6H · 12H · 24H** (Standard 24H).
- Gewählte Ansicht und Zeitspanne bleiben beim nächsten Besuch erhalten.

### 2. Ansicht „Multilinie (Option 1)": synchroner Leistungsverlauf
- Kopf: **„Synchroner Leistungsverlauf • 24H Zeitfenster"** (Zeitspanne passt sich der Auswahl an), darunter der Hinweis „Klicke auf die Legenden-Kacheln, um einzelne Kurven ein- oder auszublenden".
- Rechts vier Legenden-Kacheln mit Live-Wert: **PV x W** (Bernstein), **Haus x W** (Rosa-Rot), **Akku x W** (Cyan), **Netz x W** (Indigo-Violett).
- Ein Klick auf eine Kachel blendet die Kurve aus oder wieder ein; ausgeblendete Kacheln wirken gedimmt.
- Ein Diagramm mit allen vier Kurven als weiche Linien; die Akku-Kurve ist gestrichelt.
- Eine Nulllinie trennt Laden und Entladen bzw. Bezug und Einspeisung.
  - Akku: positiv = Laden, negativ = Entladen.
  - Netz: positiv = Bezug, negativ = Einspeisung.
- Fußzeile links: „Nulldurchgang (0W): Trennlinie für Laden/Entladen & Bezug/Einspeisung".
- Fußzeile rechts: grüner Punkt, „Abtastrate: Alle 15 Min • Zeitbasis UTC+x" mit der tatsächlichen Abtastrate und Zeitzone.
- Hover oder Antippen zeigt zum Zeitpunkt die Werte aller sichtbaren Kurven.

### 3. Ansicht „4 Kanäle (Option 2)": vier Einzeldiagramme (2 × 2)
- **PV-Erzeugung (Hoymiles + Victron)**: Bernstein-Fläche mit Verlauf, aktueller Wert oben rechts.
- **Hausverbrauch (Gesamtlast)**: Rosa-Rot-Fläche mit Verlauf, aktueller Wert.
- **Akku-Nutzung & LiFePO4 SoC**: Cyan-Linie mit Nulllinie, oben rechts „x W (y %)" mit Ladestand.
- **Netzbezug / Netzeinspeisung (Shelly Pro 3EM)**: Indigo-Linie mit Nulllinie, aktueller Wert.
- Jedes Diagramm hat ein eigenes Symbol und eine eigene Farbe wie im Bild sowie eine eigene Skala.

### 4. Erweiterte Tages-Energiebilanz (kWh)
- Kopf: **„Tages-Energiebilanz in Kilowattstunden (kWh)"** mit dem Untertitel „Vollständige Bilanzierung des Energieflusses: Erzeugung, Speicherung, Netzbezug und Verbrauch".
- Rechts das Badge **„Autarkie Heute: x %"**.
- Vier Karten:
  - **PV-Ertrag Heute** (Badge „Erzeugung"): Direktverbrauch · In Akku geladen · Netzeinspeisung.
  - **Hausverbrauch Gesamt** (Badge „Bedarf"): Aus Solar direkt · Aus Batteriespeicher · Aus öffentlichem Netz.
  - **Speicherumsatz (48V)** (Badge „LiFePO4"), Hauptwert „x kWh entl.": Ladung kumuliert · Entladung (Sun-2000) · Round-Trip Wirkungsgrad.
  - **Netzübertritt (Shelly)** (Badge „Saldierend"), Hauptwert „x kWh Bezug": Netzbezug Heute (+) · Netzeinspeisung (−) · Netto-Netzsaldo.
- Zwei Verteilungsbalken:
  - **Verteilung des Solarertrags (x kWh = 100 %)** mit „Eigenverbrauch x %"; Segmente Direkt (Bernstein) · Akku (Cyan) · Netz (Grün).
  - **Deckung des Hausverbrauchs (x kWh = 100 %)** mit „Autarkie x %"; Segmente Solar (Bernstein) · Akku (Cyan) · Netz (Violett).
  - Jeder Balken hat eine Prozent-Legende darunter.

### 5. Rest der Seite
- Der Sonnen-Tagesverlauf bleibt unverändert am Ende der Seite.

## Ablauf für den Nutzer
1. Auf der jetzigen Verlauf-Seite oben auf den kleinen Link „Neue Ansicht (Vorschau)" tippen. Alternativ ist die Vorschau direkt über `/verlauf-preview` erreichbar.
2. Die Vorschau öffnet sich mit Multilinie und 24H.
3. Die Zeitspanne wechseln (1H–24H) und mit Klicks auf die Legenden-Kacheln einzelne Kurven ausblenden.
4. Auf „4 Kanäle (Option 2)" umschalten und die vier Einzeldiagramme vergleichen.
5. Nach unten scrollen zur Tagesbilanz und zum Sonnen-Tagesverlauf.
6. Rückmeldung geben. Erst nach Freigabe ersetzt die Vorschau die echte Verlauf-Seite (Phase 2).

## Gestaltung (UI/UX)
- Dunkler Leitstand-Look wie in den Bildern:
  - fast schwarze Kacheln mit feinem Rahmen und abgerundeten Ecken
  - kleine Großbuchstaben-Titel mit farbigem Symbol
  - Werte in Monospace-Schrift
  - farbige Badges mit dezentem Rahmen
- Feste Kanalfarben überall gleich: PV Bernstein, Haus Rosa-Rot, Akku Cyan, Netz Indigo/Violett, Einspeisung Grün.
- Ruhige, weiche Kurven, feine Rasterlinien, gut lesbare Achsen (W bzw. Uhrzeit).
- Handy: Titelleiste bricht um, Umschalter bleiben voll bedienbar, Legenden-Kacheln rutschen unter den Titel. Die vier Diagramme, die Bilanzkarten und die Balken stehen untereinander. Nichts ragt über den Rand.
- Sanfte Übergänge beim Umschalten und Ein-/Ausblenden.

## Umsetzungsphasen

### Phase 1 – MVP (wird jetzt gebaut)
- Neue Vorschau-Seite `/verlauf-preview`, nicht im Menü, mit Link oben auf der jetzigen Verlauf-Seite.
- Titelleiste mit Titel, Badge „Live Synchron", Ansichts-Umschalter (Option 1/2) und Zeitauswahl 1H/3H/6H/12H/24H.
- Multilinie-Diagramm mit Legenden-Kacheln (Live-Werte, Klick zum Aus-/Einblenden), Nulllinie und Fußzeile mit Abtastrate und Zeitzone.
- Vier Einzeldiagramme in der Ansicht „4 Kanäle".
- Erweiterte Tages-Energiebilanz: vier Karten, zwei Verteilungsbalken, Autarkie-Badge.
- Sonnen-Tagesverlauf am Seitenende.
- Die jetzige Verlauf-Seite bleibt bis auf den Vorschau-Link unverändert.

### Phase 2 – Übernahme
- Nach Freigabe ersetzt die Vorschau die echte Verlauf-Seite.
- Einführungs-Karte und Grafana-Link bekommen ihren Platz im neuen Layout.
- Die Vorschau-Adresse leitet auf die Verlauf-Seite um, der Vorschau-Link entfällt.

### Phase 3 – Erweiterungen
- Vergangene Tage auswählbar (Kurven und Tagesbilanz für ein gewähltes Datum).
- Vergleich heute gegenüber gestern in der Tagesbilanz.
- Verlauf-Seite drucken / als PDF (hell & dunkel, wie Bericht und Doku).

## Annahmen
- Die Antworten auf die beiden Rückfragen kamen nicht an. Deshalb gelten die empfohlenen Optionen:
  - Vorschau-Link auf der Verlauf-Seite
  - Umschalter-Beschriftung wie im Bild „(Option 1)" / „(Option 2)"
- Der Titel wird genau wie im Bild übernommen, inklusive des Wortes „Recharts".
- Die Zeitauswahl bekommt laut Text zusätzlich **1H**, Standard ist 24H.
- Die Umschalter zeigen entweder die Multilinie **oder** die vier Einzeldiagramme, nicht beides gleichzeitig.
- Das Ein-/Ausblenden per Legenden-Kachel gilt für die Multilinie. In „4 Kanäle" sind immer alle vier Diagramme sichtbar.
- Die Abtastrate passt sich der Zeitspanne an (ca. 1 Min bei 1H bis 15 Min bei 24H). Die Fußzeile zeigt den tatsächlichen Wert und die echte Zeitzone, Ende Oktober also UTC+1.
- Live-Werte in den Legenden-Kacheln und Diagrammköpfen aktualisieren sich laufend. Die Kurven werden etwa jede Minute nachgeladen.
- Vorzeichen wie im Bild: Akku positiv = Laden, negativ = Entladen; Netz positiv = Bezug, negativ = Einspeisung.
- Zahlen werden wie in der restlichen App mit deutschem Komma angezeigt (6,84 statt 6.84).
- Die Werte im Bild sind Beispielwerte. Die Bilanz rechnet mit echten (im Demo-Modus simulierten) Tageswerten:
  - Die Prozentanteile der Balken ergeben immer 100 %.
  - Der Direktverbrauch ist die Rest-Rechnung: PV-Ertrag minus In Akku geladen minus Netzeinspeisung.
- „PV-Ertrag Heute" in der Bilanz nutzt dieselbe Grundlage wie die Dashboard-Kennzahl „Solar Ertrag Heute": die Summe der Gerätezähler Hoymiles + MPPT.
- Eigenverbrauch = (PV-Ertrag − Einspeisung) ÷ PV-Ertrag; Autarkie = (Hausverbrauch − Netzbezug) ÷ Hausverbrauch; Round-Trip = Entladung ÷ Ladung.
- Der Ladestand (SoC) erscheint im Kopf des Akku-Diagramms als Prozentwert, nicht als eigene Kurve.
- Weiterhin ausgeschlossen: 48h-PV-Prognose, CSV-Export, Watt-Beschriftungen auf Fluss-Linien und Alarm-Töne.
