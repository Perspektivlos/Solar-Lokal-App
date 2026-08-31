# Status-Update: Solar-Lokal-App (Entwicklungsstand)

Dieses Dokument gibt einen strukturierten Überblick über die jüngsten Entwicklungen, Fehlerbehebungen und Funktionserweiterungen der **Solar-Lokal-App** auf Basis der letzten Git-Commits und System-Iterationen.

---

## 1. Kürzliche Commits & Git-Historie

*   **Commit `9e1cc36` (Aktuellster Commit)**: *Revise license section to include copyright details*
    *   Überarbeitung der rechtlichen Rahmenbedingungen und Urheberrechtsangaben im Hauptverzeichnis.
    *   Präzisierung der Eigentumsverhältnisse und Verweis auf das Urheberrecht von T. Hauck (THCoding) in `COPYRIGHT.md` und `README.md`.
*   **Commit `35fd019`**: *Added P2 features and backlog items with Readme*
    *   Großes Feature-Paket und System-Härtung (siehe Detailauflistung unten).
    *   Inbetriebnahme der Erweiterten InfluxDB-Anbindung, Härtung der Geräte-Parser, sowie Einführung der Batterie-Wirkungsgrad-Berechnung.
*   **Commit `f84c352` / `9cc5ceb`**: *Text Abschnitte angepasst & Auto-generated changes*
    *   Lokalisierungsanpassungen im React-Frontend.
    *   Korrektur des App-Titels in der `index.html`.

---

## 2. Detaillierte Übersicht der umgesetzten Verbesserungen

In den letzten Entwicklungs-Zyklen wurden kritische architektonische Verbesserungen, Fehlerbehebungen und kosmetische Anpassungen durchgeführt:

### A. Physikalische Korrektur des Energie- & Verbrauchsmodells (DC-Kopplung)
*   **Problem**: Zuvor kam es im Energiefluss-Diagramm zur fehlerhaften Mitzählung der Victron-MPPT-Ladeleistung als Hauslast, wodurch der Hausverbrauch um bis zu several kW falsch berechnet wurde (~4558 W statt tatsächlichen ~1760 W). Zudem leitete das System `battery_power` fälschlicherweise aus `Trucki/METER` ab, was dem Netz-Messwert entsprach und identische Werte für Netz und Batterie erzeugte.
*   **Lösung**:
    *   Einführung der physikalisch korrekten Formel:
        $$\text{Hausverbrauch} = \text{PV\_AC (Hoymiles)} + \text{Batterie-Entladung (SUN)} + \text{Netzbezug/Einspeisung}$$
    *   Die MPPT-Ladeleistung lädt nun rein die Batterie (DC) und wird nicht mehr doppelt gezählt.
    *   Die Batterieleistung kommt nun korrekt und unabhängig aus `Trucki/ACDISPLAY` (bzw. Fallback `Trucki/ACSETPOINT`). Entladungen werden im Energiefluss getrennt von Ladevorgängen dargestellt.

### B. Härtung des Hoymiles/AhoyDTU-Parsers
*   **Problem**: AhoyDTU publiziert modulspezifische Spannungs- und Leistungswerte als JSON-Objekt unter den Topics `HM1500/ch1` bis `HM1500/ch4`. Der alte Parser suchte nach flachen Keys (wie `P_DC`) und fiel auf 0 W zurück.
*   **Lösung**: Der Parser `fetch_ahoy_from_mqtt` wurde grundlegend überarbeitet. Er liest nun die JSON-Payloads pro Kanal vollständig aus, extrahiert die Felder `P_DC`, `U_DC`, `I_DC` sowie `YieldDay` sauber und liest das Leistungslimit direkt aus `ack_pwr_limit` aus.

### C. Batterie Round-Trip-Wirkungsgrad-Kachel
*   **Neues Feature**: Einbindung einer interaktiven Kachel (`RoundTripCard.jsx`) in der Summary-Spalte des Dashboards.
*   **Funktion**: Integriert die Ladeleistungen (MPPT/DC) und Entladeleistungen (SUN/AC) trapezförmig über den Tag hinweg in Wattstunden und berechnet daraus live den aktuellen Wirkungsgrad der Batterie:
    $$\text{Effizienz \%} = \frac{\text{Entladene AC-Energie (SUN) heute in kWh}}{\text{Geladene DC-Energie (MPPT) heute in kWh}} \times 100$$
*   **Anzeigeverhalten**: Farblich adaptiver Ring-Fortschritt (Grün $\ge 85\%$, Cyan $\ge 70\%$, sonst Orange) mit intelligenter Ausblendung („–“) bei unzureichender Tagesladung ($< 0.05$ kWh), um Division-by-Zero-Fehler am Morgen zu vermeiden.

### D. Erweiterung der InfluxDB- & Grafana-Langzeitanalyse
*   **Reiche Telemetriedaten**: Das Backend schreibt nun hochauflösende Messdaten pro Zyklus (15s) in InfluxDB:
    *   `solar`: System-Messdaten inklusive Echtzeit-Autarkie (`autarky_pct`) und Eigenverbrauch (`self_consumption_pct`).
    *   `shelly_phase`: Phasen-Messwerte (L1–L3) für präzise Schieflasterkennungen.
    *   `hoymiles_ch`: Modulgenaue Erträge der Kanäle 1–4.
    *   `victron_mppt`: Status- und Leistungsdaten je Laderegler-Instanz.
    *   `trucki`: Betriebsdaten (Spannung, Strom, Temperatur, ZEPC).
*   **Dashboards im App-Stil**: Die beiden Grafana-Dashboards (`solar-influxdb-dashboard.json` und `solar-devices-dashboard.json`) wurden mit transparenten Panels, weichen Gradienten-Linien und der Neon-Farbpalette der App (PV Gelb, Netz Rot, Autarkie/Einspeisung Grün, Akku Cyan, Haus Silber) ausgestattet und gegenseitig verlinkt.
*   **Datenbank-Härtung**: Korrektur des InfluxDB-Organisation-Mismatches (Umstellung von `home` auf die vom User genutzte Org `Solar Lokal`).

### E. Bereinigung & Deployment-Härtung
*   **Cleanups**: Das vom User unerwünschte Prognose-Menü (Forecast) und die Autarkie-Ziel-Kachel sind vollständig aus Frontend UND Backend entfernt.
    *   *Frontend*: Keine Forecast-/Prognose-Ansicht im Routing oder Dashboard.
    *   *Backend*: Der Endpunkt `/api/forecast`, die Open-Meteo-Anbindung, der `forecast`-Block in `DEFAULT_CONFIG` und das `forecast`-Feld in `ConfigUpdate` wurden vollständig entfernt (im aktuellen Code per Grep verifiziert: 0 Treffer). Hinweis: `autarky_pct`/`self_consumption_pct` sind davon unabhängige, berechnete Live-Kennzahlen und bleiben bestehen.
*   **Fehlerfreie Builds**: Löschen ungenutzter shadcn-Komponenten (`carousel.jsx`, `calendar.jsx`, `command.jsx`) zur Behebung von blockierenden ESLint-Fehlern.
*   **Deployment-Reihenfolge**: Im Proxmox-Deployment-Skript `build-app.sh` wird das Backend nun *vor* dem rechenintensiven Frontend-Build gestartet, um Systemausfälle bei OOM-Fehlern zu minimieren. Zudem wurde das Node-Speicherlimit auf `2048 MB` angehoben.

---

## 3. Aktueller Status & Projekt-Gesundheit

*   **Backend-Tests**: Vorhanden sind fünf Testdateien: `test_mqtt_client.py`, `test_influx_points.py`, `test_get_config_merge.py`, `test_refactor_lifespan.py` und `test_solar_dashboard.py`. Die früher dokumentierte Zahl „17 passed" bezog sich nur auf drei Unit-Testdateien und ist als historischer Stand zu verstehen; eine aktuelle Gesamtausführung muss separat verifiziert werden.
*   **Backend-Integration**: `test_solar_dashboard.py` enthält Tests für die Dashboard-Endpunkte und kann externe Dienste beziehungsweise eine laufende App-Umgebung voraussetzen. Ergebnisse aus früheren Upstream- oder Preview-Läufen sind nicht automatisch für diesen Fork gültig.
*   **Frontend**: Die App kompiliert fehlerfrei (Exit Code 0, „Compiled successfully“), und die automatische Versionierung (`REACT_APP_VERSION` aus der `package.json` $\to$ `v1.3.0`) plus Build-Datum ist aktiv. Keine `forecast`-Referenzen mehr im Frontend-Code.
*   **API-Stand**: Die API umfasst `/api/live`, `/api/today`, `/api/history`, `/api/config` sowie Steuerungs-, Diagnose- und Integrations-Routen. Eine `/api/forecast`-Route existiert **nicht** (Forecast vollständig entfernt).

---

## 4. Zukünftiger Backlog (Vorschläge)

1.  **P1: Telegram-Bot für SoC-Meldungen**
    *   Push-Benachrichtigung bei niedrigem Akkustand ($< 15\%$) oder Ausfall eines Geräts (Wechselrichter offline).
2.  **P2: MPPT-Vergleichskachel**
    *   Visualisierung des direkten Ertragsvergleichs (Ertrag Laderegler #1 vs. #2) auf dem Dashboard.
3.  **P2: CSV-Export im Historien-Tab**
    *   Einfacher Download historischer Leistungsdaten über die Benutzeroberfläche.
