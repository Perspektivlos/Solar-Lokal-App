# Anlagen-Doku & dynamischer Energiefluss – Ausbauplan

Erweiterung des bestehenden Solar-Dashboards um eine automatische Geräte-Erkennung mit Anlagendokumentation sowie eine deutlich aufgewertete, dynamische Energiefluss-Visualisierung.
Die Geräte-Erkennung wird als erster Schritt (MVP) gebaut, der Energiefluss-Umbau folgt danach.

## Für wen
Betreiber der eigenen DC-gekoppelten Solaranlage (Shelly Pro 3EM, Hoymiles HM1500 via AhoyDTU, Trucki2Shelly Gateway, 2× Victron SmartSolar MPPT in VenusOS) – zum Überwachen, Steuern und Dokumentieren der Anlage im lokalen Netz.

## Kernfunktionen & Erlebnis

### Phase 1 – Geräte-Erkennung & Anlagendokumentation (MVP, wird jetzt gebaut)
- **Erkennen-Aktion**: Pro Gerät (und zusätzlich „Alle erkennen") lässt sich die Geräte-Identität abrufen. Im Demo-Modus liefert die Erkennung realistische Mock-Werte, im Live-Betrieb echte Daten aus dem lokalen Netz.
- **Aufklappbare Detail-Karten** auf der bestehenden „Geräte"-Seite: Jede Geräte-Karte bekommt einen Aufklapp-Bereich mit den erkannten Kenndaten.
- **Dokumentierte Kenndaten** je Gerät (soweit das Gerät sie liefert):
  - Shelly Pro 3EM: Modellkennung, Firmware-Version, MAC-Adresse, Geräte-ID, Phasen-Profil
  - Hoymiles / AhoyDTU: Wechselrichter-Name, Seriennummer, Firmware-Version, max. Leistung, Anzahl Kanäle
  - Victron VenusOS: VenusOS-Version, erkannte MPPT-Modelle (2×), Anzahl Tracker
  - Trucki2Shelly: Firmware/Version, Betriebsparameter (Leistungsgrenzen), SoC-Quelle
- **Persistenz als Doku**: Zuletzt erkannte Werte bleiben gespeichert und sichtbar, auch wenn ein Gerät später offline ist – inklusive Zeitstempel „zuletzt erkannt".
- **Status-Hinweis**: Karte zeigt, ob die Erkennung erfolgreich war, aus dem Demo-Modus stammt oder fehlgeschlagen ist (Gerät nicht erreichbar).

### Phase 2 – Dynamischer Energiefluss (danach)
- **Logisch gruppierte Knoten**: PV-Block (Hoymiles AC + Victron MPPT DC zusammengefasst), Akku/Trucki, Netz, Haus.
- **Vollständig dynamisch**: Knoten erscheinen bzw. verschwinden automatisch je nachdem, welche Geräte unter „Geräte" aktiviert sind. Verbindungspfade passen sich entsprechend an.
- **Knoten-Symbole mit Leben**: animierter Ladestand-Ring/-Balken am Akku, rotierende/pulsierende „Plasma-Sonne" am PV-Block, Frequenz-/Phasen-Signal am Netz.
- **Energieströme als Plasma/Laser**: leuchtende Energiebahnen mit fließenden Partikel-/Photonen-Schwärmen; Geschwindigkeit und Intensität (Partikeldichte, Glow-Stärke) hängen dynamisch von der jeweiligen Wattleistung ab.
- **Aufgewertetes Pfad-Layout**: sauberere Kopplung und Pfadführung zwischen den Knoten.
- **Interaktivität**: Beim Überfahren eines Knotens/Pfads mit der Maus wird der jeweilige Pfad hervorgehoben und die zugehörigen Werte eingeblendet.

### Phase 3 – Feinschliff & Optimierungen (danach)
- Firmware-/Versions-Hinweise in der Doku (z. B. Markierung veralteter Stände).
- Weitere Politur der Animationen, Performance-Optimierung und responsives Verhalten auf kleinen Bildschirmen.

## Nutzerfluss (Phase 1)
1. Nutzer öffnet die „Geräte"-Seite.
2. Jede Geräte-Karte zeigt einen Aufklapp-Pfeil und eine „Erkennen"-Aktion; oben gibt es zusätzlich „Alle erkennen".
3. Nutzer klickt „Erkennen" → kurze Lade-Anzeige → die Detail-Karte füllt sich mit Modell, Firmware, Seriennummer, MAC usw.
4. Die erkannten Werte bleiben als Dokumentation erhalten und zeigen den Zeitpunkt der letzten Erkennung.
5. Bei nicht erreichbarem Gerät (Live-Modus) erscheint ein klarer Fehlerhinweis; die zuletzt bekannten Werte bleiben sichtbar.

## UI/UX-Gefühl
- Beibehaltung der bestehenden Industrial-/SCADA-Control-Room-Ästhetik (dunkle Graphit-Panels, metallische Kanten, Neon-Akzente, Monospace-Technikschrift).
- Detail-Karten mit ruhigem Aufklapp-Verhalten; Kenndaten klar als technisches Typenschild lesbar.
- Energiefluss (Phase 2) bleibt im gleichen Look, nur deutlich lebendiger und „energetischer".

## Annahmen
- **Demo-Modus bleibt Standard.** Erkennung und Energiefluss liefern im Demo-Modus plausible Mock-Werte; echte Netzwerkabfragen nur im Live-Modus.
- **Erkennung ist manuell per Button**, nicht automatisch im Hintergrund – so bleibt der Netzwerkzugriff kontrolliert.
- **Quelle der Live-Kenndaten**: Shelly `/rpc/Shelly.GetDeviceInfo`, AhoyDTU `/api/record/info` bzw. `/api/inverter/id/{id}`, Victron VenusOS System-Info, Trucki `/status`. Felder, die ein Gerät nicht liefert, werden als „n/a" dargestellt.
- **Energiefluss-Topologie** bildet die bestätigte DC-Kopplung ab: MPPTs laden den Akku (DC), Hoymiles speist AC ins Haus, Trucki/SUN entlädt den Akku ins AC-Netz, Shelly misst am Netzanschluss.
- **Bereits gestrichene Features bleiben gestrichen**: kein CSV-Export, kein Watt-Label am Energiefluss-Pfeil, keine 48h-PV-Prognose.
- **Nur Phase 1 wird jetzt umgesetzt.** Phasen 2 und 3 folgen nach Freigabe.
