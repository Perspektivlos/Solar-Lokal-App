# Versions-Fußleiste, In-App-Roadmap & Anlagen-Anleitung

Eine durchgehende Fußleiste zeigt überall die App-Version und ist der Einstieg zu
zwei neuen Ansichten: einer selbst-aktuellen Roadmap und einer Anlagen-/App-Anleitung.
Dazu wird der Einführungstext der Projekt-Beschreibung (README) auf den aktuellen Stand gebracht.

## Für wen

Für den Betreiber der eigenen Solaranlage (Shelly Pro 3EM, Hoymiles HM-1500 über AhoyDTU,
2× Victron SmartSolar MPPT über Venus OS, Trucki2Shelly mit Lumentree-SUN-Inverter,
48 V-LiFePO4-Speicher), der jederzeit sehen will, welche App-Version läuft, was bereits
umgesetzt bzw. geplant ist, und wie Anlage und App funktionieren – alles lokal, deutsch,
im bestehenden SCADA-Look.

## Kernfunktionen & Erlebnis

**1. Fußleiste mit Version (überall sichtbar)**
- Dezente, feststehende Leiste am unteren Rand aller Seiten: App-Name + Versionsnummer,
  aktueller Modus (Demo/Live) und das Datum des letzten Stands.
- Die Versionsnummer ist der Einstieg: ein Klick öffnet die Ansicht „Doku & Roadmap".
- Bei einer neuen Version ist die Versionsnummer kurz hervorgehoben („Neu").

**2. Roadmap (selbst-aktuell)**
- Eine Ansicht, die alle Punkte mit Status zeigt: **Erledigt**, **In Arbeit**, **Geplant** –
  gruppiert und mit Datum, farblich im SCADA-Stil.
- Wird aus **einer einzigen zentralen Quelle** gespeist. Diese Quelle ist der einzige Ort,
  der beim Ausliefern neuer Funktionen gepflegt wird; die Ansicht zeigt sie immer sofort aktuell.
- Startzustand: der reale heutige Stand ist vollständig eingetragen (u. a. Geräte-Karten,
  neuer Energiefluss mit Kompakt/Detail/Tempo, Favoriten mit Drag-&-Drop, Einstellungen für
  Kapazität/Beschriftungen, Hochkant-Fluss auf Mobil) – Erledigtes als „Erledigt", offene
  Punkte als „Geplant".

**3. Anlagen-Dokumentation / Anleitung (mit aktuellen Werten verknüpft)**
Eine Ansicht mit vier Abschnitten:
- **App-Bedienung:** Dashboard, Energiefluss (Kompakt/Detail/Auto, Fluss an/aus, Tempo),
  Favoriten, Einstellungen, Steuerung, Diagnose, Verlauf – kurz erklärt.
- **Anlagen-/Geräteübersicht:** die fünf Bausteine (Shelly Pro 3EM, Hoymiles HM-1500/AhoyDTU,
  2× Victron MPPT, Trucki2Shelly/SUN, 48 V-LiFePO4) mit Beschreibung und Eckdaten.
- **Energie- & Verkabelungsmodell:** DC/AC-Kopplung, Nulleinspeisung und die
  Hausverbrauchs-Formel (Hoymiles-AC + SUN-Entladung + Netzfluss; Victron-DC lädt nur den Akku).
- **Lokales Setup:** Mosquitto-MQTT, InfluxDB, Grafana sowie Demo- vs. Live-Modus.
- Wo sinnvoll, werden **aktuelle Werte** eingeblendet: eingestellte nutzbare Akkukapazität,
  die konfigurierten Karten-Beschriftungen, der aktuelle Demo/Live-Status und zuletzt erkannte
  Gerätedaten. Dadurch bleibt die Anleitung automatisch korrekt. (Lesen/Ansehen; Bearbeiten der
  Werte bleibt in den Einstellungen.)

**4. README-Einführung aktualisiert**
- Der einleitende Beschreibungstext der Projekt-Dokumentation wird durch die vom Betreiber
  vorgegebene Fassung ersetzt: „Autarkes Energiemanagement, Nulleinspeisung & Hardware-Diagnose
  für Hoymiles, Victron, Trucki & LiFePO4 …" (vier ausgewogene Säulen). Der übrige Inhalt bleibt.

## Nutzerfluss

1. Beliebige Seite öffnen → unten die Fußleiste mit Version und Modus.
2. Auf die Version klicken → Ansicht „Doku & Roadmap" öffnet sich.
3. Zwischen **Roadmap** und **Anleitung** wechseln.
4. In der Roadmap den Stand je Punkt ablesen (Erledigt/In Arbeit/Geplant).
5. In der Anleitung einen der vier Abschnitte aufklappen; aktuelle Werte sind direkt eingeblendet.
6. Zurück zum Dashboard; die Fußleiste bleibt überall sichtbar.

## UI/UX-Gefühl

Gleiche SCADA-Control-Room-Sprache wie die App: dunkler Hintergrund, Neon-Akzente,
feine Rahmen, Mono-/LCD-Typografie. Die Fußleiste ist schlank und unaufdringlich.
Roadmap-Status über klare Farbcodes (z. B. grün = erledigt, cyan = in Arbeit, grau = geplant).
Anleitung in aufklappbaren Abschnitten, gut lesbar; responsiv (Desktop wie Mobil), deutsch.

## Umsetzungsphasen

**Phase 1 – MVP (wird jetzt gebaut):** Durchgehende Fußleiste mit Version + Modus auf allen
Seiten; Klick auf die Version öffnet die Ansicht „Doku & Roadmap". Roadmap aus einer zentralen
Quelle mit Status je Punkt, befüllt mit dem realen aktuellen Stand. Anleitung mit allen vier
Abschnitten und eingeblendeten aktuellen Werten. README-Einführungstext aktualisiert.

**Phase 2 – später:** Roadmap-Punkte direkt in der App bearbeiten (hinzufügen, abhaken,
verschieben) mit dauerhafter Speicherung; „Was ist neu"-Hinweis beim Versionssprung.

**Phase 3 – später:** „Erledigt"-Historie zusätzlich automatisch aus der Änderungs-/
Versionshistorie ableiten; Anleitung als Druck-/PDF-Ansicht exportieren.

## Annahmen

- Roadmap und Anleitung erscheinen **in der App** (nicht als zusätzliche Menüpunkte), erreichbar
  über die **Versionsnummer in der Fußleiste** – so wurde die Platzierungsfrage verstanden.
- „Selbst pflegen" bedeutet in Phase 1: **eine zentrale Datenquelle** (Version + Roadmap-Punkte +
  Stand), die beim Ausliefern gepflegt wird und in der App sofort aktuell erscheint – keine
  vollautomatische Generierung (das kommt teilweise erst in Phase 3).
- Die Roadmap wird initial mit dem **tatsächlichen heutigen Stand** befüllt (Erledigtes markiert,
  bekannte offene Punkte als „Geplant").
- Die Anleitung ist **zum Ansehen**; Werte wie Akkukapazität und Karten-Beschriftungen werden
  weiterhin in den Einstellungen geändert und hier nur gespiegelt.
- Es wird eine **Versionsnummer** eingeführt und bei künftigen Lieferungen hochgezählt; der
  Startwert wird passend zum aktuellen Stand gesetzt.
- Die eingeblendeten „aktuellen Werte" umfassen: nutzbare Akkukapazität, Karten-Beschriftungen,
  Demo/Live-Status und zuletzt erkannte Gerätedaten.
- Der README-Einführungstext wird durch die vorgegebene Fassung ersetzt; der restliche
  README-Inhalt bleibt erhalten.
- Alles auf Deutsch, im bestehenden SCADA-Look; entfernte Funktionen (Watt-Labels auf den
  Flusslinien, 48-h-Prognose, CSV-Export) bleiben entfernt. Keine neuen externen Integrationen.
