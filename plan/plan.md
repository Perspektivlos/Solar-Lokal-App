# Redesign: KPI-Leiste & Energiefluss (SCADA-Entwurf übernehmen)

Das Dashboard bekommt die Optik aus den beiden Entwürfen: oben eine KPI-Leiste aus vier
großen Geräte-Karten, darunter ein überarbeitetes Energiefluss-Diagramm mit einer schmalen
Kennzahlen-Zeile. Alle Werte kommen aus den vorhandenen Live-Daten (Demo-Modus als Standard).

## Für wen

Für den Betreiber der eigenen Solaranlage (Shelly Pro 3EM, Hoymiles HM-1500, 2× Victron MPPT,
Trucki/Sun-2000, 48 V-Speicher), der den Anlagenzustand auf einen Blick im Control-Room-Look
ablesen und zwischen Kompakt- und Detailtiefe umschalten möchte.

## Kernfunktionen & Erlebnis

**1. KPI-Leiste – vier große Geräte-Karten (ersetzt die bisherigen 6 LCD-Kacheln)**

- **Solar PV** – Status-Badge „Aktiv/Inaktiv", große aktuelle PV-Leistung (W), Tagesertrag (kWh);
  Unterzeilen: Hoymiles HM-1500 (W + Begrenzung %), Victron MPPT #1 (W, DC), Victron MPPT #2 (W, DC).
- **Batterie 48 V** – Badge SoC %, große Lade-/Entladeleistung (W) mit Hinweis „Laden/Entladung";
  Unterzeilen: Spannung / Strom (V / A), Trucki Sun-2000 Ist-Leistung (W, mit Limit), Tagesenergie (kWh).
- **Hausverbrauch** – Badge „Live", große saldierte Wirkleistung (W), Tagesbedarf (kWh);
  Unterzeilen: Hoymiles (direkt), Sun-2000 (aus Akku), Netz (Shelly 3EM, Bezug/Einspeisung).
- **Stromnetz** – Badge „Bezug/Einspeisung", große Netzleistung (W), Tagesbezug / Export (kWh);
  Unterzeilen: L1 / L2 / L3 je mit Leistung (W) und Phasenspannung (V).

**2. Energiefluss – überarbeitetes Flussdiagramm mit zwei Detailstufen**

- **Kompakt = 5 Knoten** (wie Entwurf 1): Solar PV (Hoymiles + beide MPPT zusammengefasst),
  Batterie 48 V, Hausverbrauch (zentral), Stromnetz, Sun-2000/Trucki.
- **Detail = 6 Knoten**: Solar PV wird in seine zwei Quellen aufgeteilt – Hoymiles HM-1500 (AC)
  und Victron MPPT (DC); die übrigen vier Knoten bleiben. Die Aufschlüsselung je MPPT-String
  (Panels 425 Wp / 445 Wp) bleibt wie bisher in der String-Vergleichskarte erhalten.
- **Auto** wählt je nach Bildschirmbreite automatisch Kompakt oder Detail.
- Jeder Knoten zeigt seine aktuelle Leistung und – in Detail – zusätzliche Innenzeilen
  (z. B. „AC Hoymiles → direkt", „DC Victron → in Akku", Ladestand, Modus, Regelstatus).
- Animierte Partikel auf den Verbindungen; Geschwindigkeit skaliert mit der Leistung.
  (Keine Watt-Beschriftungen auf den Flusslinien – bleibt wie vereinbart entfernt.)

**3. Steuerleiste über dem Diagramm**

- **Fluss an/aus** – Partikelanimation ein-/ausschalten.
- **Auto / Kompakt / Detail** – Detailtiefe (wie bisher, bleibt erhalten).
- **Tempo 1× / 1.5× / 2×** – neuer Regler für die Partikelgeschwindigkeit.

**4. Kennzahlen-Zeile unter dem Energiefluss (vier Kacheln)**

Solar Ertrag Heute (kWh + aktuell W), Batterie Kapazität (SoC % + geschätzte kWh),
Netzbezug Heute (kWh + aktuell W), Autarkiegrad (% + „Eigenabdeckung").

## Nutzerfluss

1. Dashboard öffnen → oben die vier Geräte-Karten mit Live-Werten, darunter der Energiefluss,
   darunter die vier Zusammenfassungs-Kacheln.
2. Über der Flussgrafik Detailtiefe wählen (Auto/Kompakt/Detail), Fluss an/aus schalten,
   Tempo einstellen.
3. Werte aktualisieren sich automatisch im laufenden Takt; Badges und Farben ändern sich mit
   dem Zustand (z. B. Bezug rot / Einspeisung grün, Laden/Entladen, Aktiv/Inaktiv).
4. Bestehende Funktionen (Favoriten-Leiste, Sonnen-Tagesverlauf, Geräte-Detailbereiche,
   Alarme) bleiben unverändert darüber/darunter erhalten.

## UI/UX-Gefühl

Industrieller SCADA-Control-Room-Look wie im Entwurf: dunkler Hintergrund, Neon-Akzente je
Gerät (PV orange/gelb, Batterie cyan/grün, Netz violett/rot, Haus hell), abgesetzte Karten mit
feinem Rahmen-Glühen, LCD-artige Großwerte, dezente Status-Badges. Responsiv: vier Karten auf
Desktop nebeneinander, auf Mobil gestapelt; Energiefluss passt die Knotenanordnung an die Breite
an. Keine neuen Schriftarten oder Farbwelten – es wird die vorhandene Designsprache genutzt.

## Umsetzungsphasen

**Phase 1 – MVP (wird jetzt gebaut):** Vollständiger Umbau wie oben – vier Geräte-Karten ersetzen
die 6 LCD-Kacheln; Energiefluss mit Kompakt (5)/Detail (6)/Auto, Fluss an/aus und Tempo-Regler;
vier Zusammenfassungs-Kacheln unter dem Diagramm. Alle Werte an die vorhandenen Live-Daten
gebunden; Demo-Modus als Standard.

**Phase 2 – später:** Einstell-Oberfläche für die statischen Gerätebeschreibungen und die nutzbare
Akkukapazität; kleine 15-Minuten-Trend-Sparklines in den Geräte-Karten.

**Phase 3 – später:** Schwellwert-Farbalarme je Karte/Kachel; echte Netzfrequenz und
Batterie-Zelldrift, sobald diese Messwerte real vom Gerät geliefert werden.

## Annahmen

- **Datenwahrheit:** Es werden nur tatsächlich vorhandene Mess-/Demo-Werte als „Live" angezeigt.
  Zwei im Entwurf gezeigte Werte liegen aktuell nicht in den Daten vor und werden in Phase 1 **nicht**
  erfunden: statt „Max Zellendrift" zeigt die Batterie-Karte die vorhandene **Tagesenergie (kWh)**;
  die Netzfrequenz „50 Hz" entfällt (kommt erst in Phase 3, wenn real vorhanden).
- **Gerätebeschriftungen** (z. B. „6× Power Queen 100 Ah", „Shelly Pro 3EM (L1/L2/L3)",
  „RS485 Nulleinspeiser") sind feste, beschreibende Texte – keine Live-Werte.
- **Batterie-Kapazität:** Für die Kachel „Batterie Kapazität" wird eine nutzbare Kapazität von
  **9,6 kWh** angenommen (Wert aus dem Entwurf) und die kWh als SoC × Kapazität geschätzt; später
  in den Einstellungen änderbar (Phase 2).
- **Autarkiegrad** wird aus den Live-Werten berechnet (Eigenerzeugung gegenüber Hausverbrauch);
  bei Einspeisung ~100 %.
- Der bisherige Auto-Modus (Umschalten nach Bildschirmbreite) bleibt erhalten; „Anzeigen: Aus"
  aus dem Entwurf wird durch die beibehaltene Kompakt/Detail-Umschaltung abgedeckt.
- Entfernte Funktionen bleiben entfernt: keine Watt-Labels auf den Flusslinien, keine 48 h-Prognose,
  kein CSV-Export.
