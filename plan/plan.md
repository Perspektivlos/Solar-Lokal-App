# Projektbericht-Seite – „Was wir erreicht haben"

Eine eigene, scrollbare Bericht-Seite, die den gesamten Projektverlauf erzählt: welche Funktionen entstanden sind, was was abgelöst hat, was bewusst entfernt wurde – plus Arbeitsweise, Erkenntnisse, Zeitachse und Technik auf einen Blick.
Erreichbar nur über eine eigene Vorschau-Adresse (nicht im Menü), im bestehenden SCADA-Dark-Look.

## Für wen
- Den Betreiber der Anlage selbst, als Rückblick und Nachschlagewerk über den Stand des Projekts.
- Personen, denen man das Projekt zeigen möchte (z. B. im Heimnetz), ohne durch die ganze App klicken zu müssen.

## Kernfunktionen & Erlebnis
Eine einzelne, von oben nach unten lesbare Seite mit folgenden Abschnitten:

1. **Kopf / Titel** – Projektname, aktuelle Version und Stand-Datum, ein Satz zum Zweck der App, dazu ein paar Kennzahlen-Kacheln (z. B. Anzahl Funktionen erledigt / in Arbeit / geplant, Anzahl angebundener Gerätetypen, Anzahl Ausbaustufen).

2. **Funktions-Changelog: hinzugefügt / abgelöst / entfernt** – das Herzstück. Drei klar getrennte, farbcodierte Bereiche:
   - **Hinzugefügt**: alle gebauten Funktionen (Live-Dashboard, animierter Energiefluss, Geräte-Karten, Favoriten inkl. MPPT-Strings & Phasen, Sonnen-Tagesverlauf, Steuerung Hoymiles/Trucki, Diagnose/Selbsttest, Grafana/InfluxDB-Anbindung, Versions-Fußleiste, Doku & Anleitung, editierbare Roadmap, „Was ist neu?"-Fenster, konfigurierbare Akkukapazität & Gerätebeschriftungen u. a.).
   - **Abgelöst / ersetzt**: was durch Neueres verdrängt wurde, jeweils als „vorher → nachher" (z. B. sechs LCD-Kacheln → vier große Geräte-Karten; aggregierter PV-Block → einzelne Geräte-Knoten im Energiefluss; alter Footer-Roadmap-Dialog → fixe Versions-Fußleiste + Doku-Seite; statische Roadmap → dauerhaft editierbare Roadmap).
   - **Komplett entfernt / abgelehnt**: bewusst nicht umgesetzte Dinge mit kurzer Begründung (48-Stunden-PV-Prognose, Watt-Beschriftungen auf den Energiefluss-Linien, CSV-Export).

3. **Zeitachse / Meilensteine** – chronologische Liste der Ausbaustufen mit Datum, als senkrechter Verlauf, von den Grundlagen bis zur aktuellen Version.

4. **Arbeitsweise & Verhalten bei Aufgaben** – in verständlicher Sprache, wie im Projekt gearbeitet wurde: erst Rückfragen und Freigabe, dann Umsetzung, dann Prüfung (eigene Tests bzw. Testdurchläufe) und saubere Abnahme; Demo-Modus als Standard, damit nichts Echtes ungewollt angesprochen wird; keine ungefragten neuen Funktionen.

5. **Erlernte Fähigkeiten / Erkenntnisse** – konkrete Stolpersteine und wie sie gelöst wurden (z. B. Grafana fand die Datenquelle nicht → feste Kennung vergeben; Firmware-Angabe war ein Objekt statt Text → richtig ausgelesen; Energiefluss-Darstellung auf dem Handy als echtes Hochformat; deutsche Zahlenformate mit Komma).

6. **Technik-Überblick** – kompakte Übersicht: Art der App (lokales Dashboard), angebundene Geräte (Shelly Pro 3EM, Hoymiles HM-1500/AhoyDTU, Trucki2Shelly/SUN-2000, 2× Victron SmartSolar MPPT, LiFePO4-Speicher), genutzte Bausteine (MQTT-Broker, Zeitreihen-Datenbank, Grafana) und der Hinweis, dass alles lokal läuft.

Zusätzlich: eine dezente Kopfzeile mit Sprungmarken zu den Abschnitten und ein „Zurück nach oben"-Knopf. Die Seite ist reiner Lesestoff – keine Bearbeitung, keine Steuerung von Geräten.

## Nutzerfluss
1. Die Person öffnet die eigene Bericht-Adresse direkt im Browser.
2. Oben erscheinen Titel, Version und die Kennzahlen-Kacheln.
3. Beim Scrollen folgen nacheinander: Changelog (hinzugefügt / abgelöst / entfernt), Zeitachse, Arbeitsweise, Erkenntnisse, Technik.
4. Über die Sprungmarken oben springt man direkt zu einem Abschnitt; der „Zurück nach oben"-Knopf bringt wieder an den Anfang.
5. Auf dem Handy liegen alle Inhalte in einer gut lesbaren Spalte untereinander.

## UI/UX-Gefühl
- Gleicher dunkler Industrial-/Control-Room-Look wie die übrige App, mit Neon-Akzenten und der bekannten Schrift.
- Farbcodierung im Changelog: Grün für Hinzugefügt, Blau/Gelb für Abgelöst, Rot/Grau für Entfernt – damit der Unterschied sofort erkennbar ist.
- Ruhiges, großzügiges Layout mit viel Abstand, Karten und Trennlinien; sanfte Einblend-Animation beim Scrollen.
- Vollständig auf Deutsch.

## Umsetzungsphasen

**Phase 1 (wird jetzt gebaut – MVP):**
- Eigene Vorschau-Seite unter einer eigenen Adresse (nicht im Menü).
- Alle sechs Abschnitte mit fest kuratiertem Inhalt: Kopf/Kennzahlen, Changelog (hinzugefügt/abgelöst/entfernt), Zeitachse, Arbeitsweise, Erkenntnisse, Technik.
- Sprungmarken oben, „Zurück nach oben"-Knopf, SCADA-Look, voll auf Desktop und Handy nutzbar.

**Phase 2 (später, nur auf Wunsch):**
- Druck-/PDF-freundliche Ansicht des Berichts zum Teilen oder Archivieren.
- Optionaler Einstieg aus der Doku-Seite oder der Fußleiste heraus.

**Phase 3 (später, nur auf Wunsch):**
- Teile des Changelogs automatisch aus den gespeicherten Roadmap-Daten speisen, damit sich der Bericht mitpflegt.
- Kleine Vorher/Nachher-Vorschaubilder oder Screenshots je Meilenstein.

## Annahmen
- Die Seite liegt unter einer eigenen Vorschau-Adresse (sinngemäß `/bericht` bzw. `/report-preview`) und wird nicht ins Hauptmenü aufgenommen.
- Inhalte sind fest kuratiert und spiegeln den Stand bis zur aktuellen Version (1.5.0, Stand 29.10.2026) wider; sie aktualisieren sich nicht automatisch.
- Der Bericht ist rein lesend – keine Bearbeitung, kein Export, keine Gerätesteuerung in Phase 1.
- Keine neuen externen Integrationen; die Seite nutzt nur bereits vorhandene Projektdaten.
- Kein Login – wie in der übrigen lokalen App.
- Sprache durchgehend Deutsch; bestehende Seiten, Roadmap und Anleitung bleiben unverändert.
- Die bereits entfernten Funktionen (48-Stunden-Prognose, Watt-Labels am Energiefluss, CSV-Export) werden nicht wieder eingeführt, sondern nur im Bericht als „bewusst entfernt" erwähnt.
