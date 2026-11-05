# Einheitliche Gerätekennzahlen im Solar-Leitstand

Der Energiefluss erhält wieder direkt erkennbare Leistungs- und Peak-Informationen an den angeschlossenen Geräten.
Die Gerätekarten verwenden ein einheitliches Format aus aktueller Leistung in Watt und einer passenden Prozentkennzahl.

## Who it's for

Für Betreiber der lokalen Solaranlage, die auf einen Blick erkennen möchten, wie viel jedes Gerät aktuell leistet, welche Nenn- beziehungsweise Peak-Leistung hinterlegt ist und wie stark das Gerät relativ dazu ausgelastet ist.

## Core features and experience

- An jedem geeigneten Gerät im Energiefluss werden drei Werte angezeigt:
  - aktuelle Leistung in Watt,
  - hinterlegte Peak- oder Nennleistung in Watt,
  - daraus berechnete Auslastung in Prozent.
- Die Geräteinformationen erscheinen wieder unmittelbar am jeweiligen Gerät und nicht nur in separaten Detailbereichen.
- Alle passenden Gerätekarten übernehmen das kompakte, einheitliche Muster „W & %“:
  - Hoymiles und Victron: aktuelle Leistung und Anteil an der jeweiligen Peak-Leistung,
  - Akku beziehungsweise Trucki/SUN-2000: aktuelle Leistung und SoC,
  - Netz/Shelly: aktuelle Leistung und ein sinnvoller Richtungs- beziehungsweise Bezugsanteil, sofern die vorhandenen Messwerte eine belastbare Prozentangabe ermöglichen.
- Positive und negative Leistungsrichtungen bleiben fachlich lesbar, insbesondere Laden/Entladen und Bezug/Einspeisung.
- Fehlende oder nicht konfigurierte Peak-Werte werden als „–“ dargestellt; es werden keine Prozentwerte erfunden.
- Die vorhandenen Gerätefarben und die etablierte Leitstand-Sprache bleiben unverändert.

## User flow

1. Der Betreiber öffnet das Dashboard.
2. Im Energiefluss sieht er an jedem geeigneten Gerät Live-Leistung, Peak-Leistung und aktuelle Auslastung.
3. In den Gerätekarten findet er dieselben Informationen in einem einheitlichen „W & %“-Muster wieder.
4. Bei Akku und Netz wird die Prozentangabe an die fachlich passende Bedeutung angepasst, statt eine PV-Auslastung vorzutäuschen.
5. Ist ein Peak-Wert nicht verfügbar, bleibt die Live-Leistung sichtbar und die fehlende Vergleichsgröße wird eindeutig mit „–“ gekennzeichnet.

## UI/UX feel

- Dunkler SCADA-Leitstand mit den bestehenden Kanal-Farben und ohne neue Stilrichtung.
- Leistungswert und Prozentwert besitzen dieselbe visuelle Hierarchie wie bei Hoymiles.
- Peak-Werte werden kleiner und ruhiger dargestellt, damit die Live-Leistung dominant bleibt.
- Einheiten stehen direkt am Wert; lange Bezeichnungen umbrechen kontrolliert.
- Die zusätzlichen Informationen dürfen weder Gerätegrafik noch Energiefluss-Pfeile verdecken.
- Desktop und Mobilansicht bleiben ohne horizontales Scrollen oder abgeschnittene Werte nutzbar.

## Implementation phases

### Phase 1 — MVP, wird jetzt gebaut

- Peak-, Live-Leistungs- und Auslastungsinformationen an allen geeigneten Geräten im Energiefluss wiederherstellen.
- Gerätekarten auf das einheitliche „W & %“-Muster umstellen.
- Fachlich passende Prozentwerte für PV, Akku und Netz verwenden.
- Sichere Platzhalter für fehlende Peak- oder Vergleichswerte anzeigen.
- Bestehende Farben, Vorzeichen, Beschriftungen und responsive Darstellung bewahren.

### Phase 2 — spätere Erweiterung

- Peak- und Nennleistungen direkt in den Geräteeinstellungen bearbeitbar machen, sofern sie bislang nur aus Geräte- oder Integrationsdaten stammen.
- Abweichungen zwischen konfigurierter Nennleistung und gemeldeten Gerätedaten sichtbar machen.

### Phase 3 — spätere Erweiterung

- Tages- und Monatsauslastung je Gerät ergänzen.
- Auffällige Über- oder Unterauslastung als Diagnosehinweis in Verlauf und Selbsttest aufnehmen.

## Assumptions

- „Peak“ bezeichnet bei PV-Geräten die vorhandene konfigurierte oder vom Gerät gemeldete maximale Leistung.
- Die Auslastung eines PV-Geräts wird als aktuelle Leistung geteilt durch Peak-Leistung berechnet und auf einen verständlichen Prozentbereich begrenzt.
- Für Akku/Trucki ist der SoC die passende Prozentkennzahl; die aktuelle Lade- oder Entladeleistung bleibt in Watt sichtbar.
- Für Shelly/Netz wird nur dann eine Prozentkennzahl gezeigt, wenn dafür bereits eine fachlich belastbare Bezugsgröße existiert; andernfalls erscheint „–“.
- „Alle passenden Geräte“ umfasst Hoymiles, Victron-MPPTs, Akku/Trucki und Shelly/Netz, nicht reine Status- oder Wetterelemente.
- Die Änderung betrifft ausschließlich Darstellung und Ableitung vorhandener Gerätedaten; Steuerlogik, Grenzwerte und Hardwarekommunikation bleiben unverändert.
- Phase 1 ist der einzige Umfang, der nach Freigabe dieses Plans umgesetzt wird.

---

# Victron SmartShunt IP65 300A – lokale Integration per Venus OS

Der neue SmartShunt wird als maßgebliche, lokale Quelle für Batteriezustand und Batteriefluss in den Solar-Leitstand aufgenommen.
Die vollständige Integration wird zunächst als getrennte Vorschau für Dashboard, Geräte, Diagnose und Verlauf bereitgestellt; die freigegebenen Hauptseiten bleiben bis zur Abnahme unverändert.

## Who it's for

Für Betreiber der lokalen Solaranlage, die Spannung, Strom, Leistung, Ladezustand, Mittelpunktüberwachung, Alarmzustände und Langzeitwerte des 48-V-Speichers zuverlässig aus dem Victron SmartShunt ablesen und auswerten möchten.

## Core features and experience

- Rein lokale, schreibgeschützte Anbindung des per USB am Venus-OS-Gerät angeschlossenen **SmartShunt IP65 300A**.
- Fest verifizierte Geräteidentität über **VRM-Instanz 290**, Produktname, Verbindungsstatus und USB-/VE.Direct-Verbindung. Werte werden erst nach erfolgreicher Identitätsprüfung als gültig übernommen.
- Der SmartShunt wird maßgebliche Quelle für:
  - Batteriespannung in Volt,
  - Batteriestrom in Ampere,
  - Batterieleistung in Watt,
  - Ladezustand in Prozent,
  - Restlaufzeit, sofern gemeldet.
- Vorzeichen bleiben fachlich erhalten: **positiv = Laden**, **negativ = Entladen**.
- Trucki/SUN bleibt unverändert Quelle für Wechselrichter-Ausgang, AC-Sollwert, Nulleinspeisung und Regelung. SmartShunt- und Trucki-Werte werden nicht stillschweigend vermischt.
- Optionale SmartShunt-Werte erscheinen ausschließlich, wenn sie tatsächlich gemeldet und als verfügbar erkannt werden:
  - Mittelpunktspannung oberer und unterer Batteriebereich,
  - Mittelpunktabweichung,
  - Temperatur,
  - Starterspannung.
- Alarmstatus mit klarer Bedeutung: OK, Warnung oder Alarm.
- Unterstützte Alarmgruppen: Batteriespannung niedrig/hoch, niedriger SoC, Temperatur niedrig/hoch, Starterspannung niedrig/hoch und Mittelpunktabweichung.
- Historische SmartShunt-Zähler werden als vom Gerät gemeldete Werte übernommen, nicht aus Live-Samples nachgerechnet:
  - tiefste, letzte und durchschnittliche Entladung,
  - Ladezyklen und vollständige Entladungen,
  - gesamte bezogene Ah,
  - minimale und maximale Spannung,
  - Zeit seit vollständiger Ladung,
  - Synchronisierungen und Alarmzähler,
  - geladene und entladene Energie.
- Ein eigener Verlauf zeigt mindestens SoC, Spannung, Strom und Leistung. Optionale Mittelpunkt- oder Temperaturkurven erscheinen nur bei vorhandenen Daten.
- Datenqualität ist jederzeit sichtbar: aktuell, veraltet oder nicht verfügbar.
- Nach Verbindungsaufbau wird ein vollständiger Datenstand angefordert; danach hält eine zurückhaltende lokale Aktualisierung die Venus-Daten verfügbar.
- Bei Ausfall werden keine Trucki-Schätzwerte als SmartShunt-Messung ausgegeben. Der letzte Wert darf nur eindeutig als veraltet erscheinen.
- Keine Cloud-/VRM-Portal-Abhängigkeit, keine Schreibbefehle und keine Änderung der bestehenden Regelungslogik.

## User flow

1. Venus OS erkennt den SmartShunt als Batterie-Gerät mit Instanz 290.
2. Die App prüft Identität, Verbindung und Aktualität, bevor Batteriewerte freigegeben werden.
3. Der Betreiber öffnet die neue SmartShunt-Vorschau.
4. In der Vorschau wechselt er zwischen vier Bereichen:
   - **Dashboard:** Batterie-Leistung, Spannung, Strom, SoC, Richtung und Datenstatus im späteren Dashboard-Kontext.
   - **Geräte:** eigene SmartShunt-Gerätekarte mit Produkt, Verbindung, Firmware, Instanz und verfügbaren Sensorwerten.
   - **Diagnose:** Alarmstatus, Datenalter, Geräteidentität und die vom SmartShunt gemeldeten historischen Zähler.
   - **Verlauf:** Kurven für SoC, Spannung, Strom und Leistung sowie optionale Sensorverläufe.
5. Nicht angeschlossene oder nicht gemeldete Sensoren erscheinen nicht und erzeugen keine falschen Nullwerte.
6. Bei fehlenden Daten wechselt die Anzeige nachvollziehbar von aktuell zu veraltet und anschließend zu nicht verfügbar.
7. Nach visueller und fachlicher Freigabe werden die Vorschau-Bausteine in die bestehenden Hauptseiten übernommen.

## UI/UX feel

- Bestehender dunkler SCADA-Leitstand mit Batterie-Cyan als Hauptakzent; keine Nachbildung der VictronConnect-Oberfläche.
- Live-Leistung und SoC besitzen dieselbe klare Hierarchie wie die bestehenden Gerätekennzahlen.
- Spannung und Strom stehen direkt daneben, ohne Energiefluss oder Gerätesymbol zu überdecken.
- Laden und Entladen sind durch Vorzeichen, Richtungstext und Farbe eindeutig unterscheidbar.
- Datenquelle sichtbar als **SmartShunt · Instanz 290 · USB**.
- Aktuell/Veraltet/Nicht verfügbar wird kompakt, aber unübersehbar dargestellt.
- Optionale Werte werden vollständig ausgeblendet, statt leere Karten oder erfundene Nullen zu zeigen.
- Alarme verwenden die bestehende Leitstand-Sprache und Farblogik; es gibt keinen akustischen Alarm.
- Historische Zähler sind dicht, ruhig und gut scanbar; lange Bezeichnungen umbrechen kontrolliert.
- Seriennummern werden in der normalen Oberfläche verkürzt dargestellt; die vollständige Kennung bleibt ausschließlich in einer lokalen Detailansicht sichtbar.
- Desktop und Mobil bleiben ohne horizontales Scrollen, abgeschnittene Einheiten oder überlagerte Diagramme nutzbar.

## Implementation phases

### Phase 1 — MVP, wird jetzt gebaut

- Lokale Venus-OS-Anbindung für `battery/290` inklusive vollständiger Erstabfrage und regelmäßiger Aktualisierung.
- Prüfung von Produktname, Instanz, Verbindung und Datenalter.
- SmartShunt als maßgebliche Quelle für Batterie-Spannung, -Strom, -Leistung und SoC.
- Sichere Zustände für aktuell, veraltet und nicht verfügbar; kein stiller Rückfall auf Trucki-Schätzwerte.
- Speicherung und Bereitstellung der Live-Verläufe sowie der vom Gerät gemeldeten Historien- und Alarmwerte.
- Eine getrennte **SmartShunt-Vorschau** mit den Bereichen Dashboard, Geräte, Diagnose und Verlauf.
- Dynamische Darstellung optionaler Mittelpunkt-, Temperatur- und Starterspannungswerte.
- Bestehende Hauptseiten und bestehende Trucki/SUN-Regelung bleiben unverändert.

### Phase 2 — nach Freigabe der Vorschau

- Abgenommene SmartShunt-Bausteine in Dashboard, Energiefluss, Geräte, Diagnose und Verlauf übernehmen.
- Bisherige SoC-/Batteriespannungs-Schätzwerte dort eindeutig durch SmartShunt-Werte ersetzen.
- SmartShunt-Messfelder und Einheiten in die geplante InfluxDB-/Grafana-Neuabstimmung aufnehmen.
- Offizielles SmartShunt-Handbuch in den Geräte-Handbuchbereich aufnehmen.

### Phase 3 — spätere Erweiterung

- Mehrere Batterieinstanzen automatisch erkennen statt ausschließlich Instanz 290 zu verwenden.
- Datenqualität, Synchronisation und Kalibrierabweichungen langfristig auswerten.
- Alarmereignisse und auffällige Batteriezyklen in Diagnose und Projektbericht zusammenführen.
- Erweiterte Batterieauswertung mit Zyklen, Entladetiefe und Kapazitätstrend.
- Schreibende oder regelungsrelevante Nutzung nur nach einer separaten ausdrücklichen Freigabe.

## Assumptions

- Das USB-Kabel verbindet den SmartShunt mit dem vorhandenen Venus-OS-Gerät; die App greift nicht direkt auf einen seriellen USB-Port zu.
- Der SmartShunt ist auf Venus OS als Batterie-Service mit **VRM-Instanz 290** sichtbar.
- Die bestehende lokale Venus-/MQTT-Verbindung kennt bereits Host, Port und Portal-ID; es werden keine VRM-Cloud-Zugangsdaten benötigt.
- Die lokale Topic-Struktur entspricht `N/<Portal-ID>/battery/290/...`.
- Produktname, Instanz und Verbindungsstatus müssen zusammenpassen; andernfalls bleibt die Quelle nicht verfügbar.
- Der SmartShunt ist in VictronConnect korrekt auf Batteriekapazität, geladene Spannung, Ladeerkennung, Peukert-Wert und Ladeeffizienz eingestellt.
- SmartShunt-Strom und -Leistung verwenden die Victron-Konvention **positiv Laden / negativ Entladen**.
- Der Screenshot mit oberer/unterer Bereichsspannung deutet auf eine konfigurierte Mittelpunktmessung hin; angezeigt wird sie trotzdem nur, wenn die entsprechenden Venus-Werte tatsächlich eintreffen.
- Temperatur- und Starterspannungswerte werden nicht aus anderen Messungen abgeleitet.
- Historische SmartShunt-Zähler sind Gerätezähler und werden nicht zurückgesetzt oder neu berechnet.
- Der SmartShunt ist nur für Batteriemessung maßgeblich. Trucki/SUN bleibt alleinige Quelle für AC-Ausgang und Regelung.
- Veraltet beginnt nach 90 Sekunden ohne gültigen Wert; nicht verfügbar nach 180 Sekunden, bei `Connected=0` oder falscher Geräteidentität.
- Der erste vollständige Datenstand wird aktiv angefordert; weitere Aktualisierungen erfolgen zurückhaltend, damit Venus OS nicht unnötig belastet wird.
- Phase 1 verwendet das bestehende Preview-Prinzip und verändert keine freigegebene Hauptansicht.
- Es werden keine akustischen Alarmhinweise ergänzt.