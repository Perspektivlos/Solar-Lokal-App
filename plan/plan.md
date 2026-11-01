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