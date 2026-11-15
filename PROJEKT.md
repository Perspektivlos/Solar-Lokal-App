# PROJEKT · HauckLab Solar Energie

## About

**HauckLab Solar Energie** ist eine selbst aufgebaute, cloudfreie Heim-Energieanlage in Frankfurt am Main.
Sie verbindet zwei PV-Pfade, einen 48-V-LiFePO₄-Speicher mit 15,36 kWh und eine Regelung auf Nulleinspeisung.
Gesteuert und überwacht wird alles von der **Solar-Lokal-App** auf Proxmox VE.
Das Ziel ist, aus dem Energiemonitoring einen **„SystemBoss“** zu machen, der die Anlage sieht, regelt, auswertet und prüft,
ohne Cloud-Anbindung.

> Dieses Dokument beschreibt die **Anlage als Projekt** (Ziel, Aufbau, Datenmodell, Stand, Roadmap).
> Bedienung, Installation und API-Details stehen in [`README.md`](README.md), Arbeitsregeln für Agenten in
> [`.github/solar-lokal-energy-invariants.md`](.github/solar-lokal-energy-invariants.md).

---

## 1. Projektziel

| Ziel | Umsetzung |
|---|---|
| Eigenverbrauch maximieren, keine ungewollte Einspeisung | Trucki2Shelly regelt den SUN-Wechselrichter per ZEPC auf ein Netz-Sollziel |
| Vollständig lokal | MQTT (Mosquitto), InfluxDB und Grafana im Heimnetz, kein VRM-/Hersteller-Cloudzugriff |
| Eine Steuerzentrale | Die Solar-Lokal-App deckt vier Säulen ab: **Visualisieren · Steuern · Analysieren · Diagnostizieren** |
| Nachvollziehbare Messwerte | Jede Messgröße hat genau eine Quelle, Datenlücken bleiben sichtbar |
| Wartbar und sicher | ACL-gesichertes MQTT, Backups per `vzdump`, Änderungen nur über Branch und PR |

---

## 2. Hardware

| Bereich | Gerät | Rolle | Anbindung |
|---|---|---|---|
| Netzzähler | Shelly Pro 3EM | Bezug und Einspeisung am Netzanschluss, alle drei Phasen | MQTT `venus/grid/shellypro/#`, HTTP-Fallback `/rpc/EM.GetStatus` |
| PV direkt ins Hausnetz (AC) | Hoymiles HM-1500 + AhoyDTU | Speist PV-Strom direkt ins Hausnetz, Werte je Kanal CH1–CH4 | MQTT `venus/pv/ahoydtu/#`, HTTP `/api/live` |
| PV in die Batterie (DC) | 2× Victron SmartSolar MPPT 150/35 | Laden die Batterie direkt auf der Gleichstromseite | Venus OS, MQTT `N/<Portal-ID>/solarcharger/<Instanz>/…` |
| Batteriemessung | Victron SmartShunt IP65 300 A | Einzige Quelle für Batterie-V/A/W/SoC (Phase 2) | Venus OS, MQTT `N/<Portal-ID>/battery/290/#` (nur lesen) |
| Speicher | 6× Power Queen 25,6 V / 100 Ah, verschaltet als **2S3P** | Zusammen 51,2 V, 300 Ah, **15,36 kWh** | – |
| Entladeregelung | Trucki2Shelly Gateway (T2SG) | Gibt Batteriestrom geregelt ins Hausnetz ab (ZEPC-Regelung auf Nulleinspeisung) | MQTT **`TRUCKI/#`** |
| Wechselrichter Batterie → AC | Lumentree SUN-2000G2-H | Batterieentladung ins Hausnetz | über T2SG |

---

## 3. Energiefluss und Rechenmodell

Die Anlage ist **DC-gekoppelt**:

```
PV-Strings ──► Victron MPPT 1+2 ──(DC)──► Akku 48 V ──► SUN-2000 (Trucki) ──(AC)──┐
PV-Module  ──► Hoymiles HM-1500 ──────────────────────────────────────(AC)──────┼──► Haus ◄──► Shelly 3EM ◄──► Netz
```

Hausverbrauch (AC-Bilanz):

```
Haus = PV_AC (Hoymiles) + Entladung (SUN/Trucki) + Netz (Shelly, + Bezug / − Einspeisung)
```

- Die Ladeleistung der MPPTs zählt **nie** als Hausverbrauch, sonst würde sie doppelt gerechnet.
- Die Trucki-Entladung kommt aus `ACDISPLAY`, Fallback ist `ACSETPOINT`. `METER` ist ein eigenes Zählersignal.
- **Phase 2:** Batteriewerte kommen vom SmartShunt (DC-Seite), AC-Ausgang und ZEPC kommen von Trucki/SUN (AC-Seite).
  Fehlen SmartShunt-Werte, bleibt eine Lücke. Sie wird weder mit Trucki-Schätzwerten noch mit Null gefüllt.
- Jede Quelle hat ihren eigenen Live-Status. Demo-Werte gibt es nur für die Quelle, die gerade ausgefallen ist.

---

## 4. Infrastruktur

| Dienst | Host | Hinweis |
|---|---|---|
| Proxmox VE | 192.168.0.200 | Host für alle Container |
| Solar-Lokal-App | CT 225 · 192.168.0.222 | FastAPI-Backend + React-Frontend hinter nginx |
| Mosquitto (MQTT) | 192.168.0.201 | ACL-Benutzer, OpenSSL-Zertifikate; Port 1883 im LAN bewusst beibehalten |
| Grafana | 192.168.0.202 | Dashboards aus `deploy/grafana/` |
| InfluxDB 2.x | 192.168.0.203 | Bucket `solar`, Schreibtakt 15 s |
| Venus OS | Raspberry Pi · 192.168.0.111 | MQTT-Bridge zum Broker, Victron-Geräte |

### MQTT-Topics (verbindlich)

| Gerät | Topic | Richtung |
|---|---|---|
| Trucki2Shelly | `TRUCKI/#` | lesen |
| Trucki2Shelly | `TRUCKI/ACSETPOINTOVR`, `ZEPCOVR`, `TARGETOVR`, `MAXPOWEROVR`, `MINPOWEROVR`, `REBOOTOVR` | schreiben, ohne Retain |
| AhoyDTU | `venus/pv/ahoydtu/#` | lesen |
| Shelly Pro 3EM | `venus/grid/shellypro/#` | lesen |
| Venus OS | `N/<Portal-ID>/#`, Keepalive `R/<Portal-ID>/keepalive` | lesen, keine `W/`-Befehle |

Topics unterscheiden Groß- und Kleinschreibung. Das Trucki-Präfix entspricht dem Gerätenamen am T2SG (`TRUCKI`) und
liegt im Code zentral als `TRUCKI_TOPIC_PREFIX` in `backend/mqtt_client.py`.

---

## 5. Software

| Schicht | Technik | Ort |
|---|---|---|
| Backend | Python, FastAPI, liest zuerst MQTT, sonst HTTP, Snapshots in MongoDB | `backend/` |
| Frontend | React, Tailwind, Stil Dark Glassmorphism | `frontend/` |
| Zeitreihen | InfluxDB: `solar`, `shelly_phase`, `hoymiles_ch`, `victron_mppt`, `trucki` | `backend/influx_points.py` |
| Visualisierung | Grafana-Vorlagen | `deploy/grafana/`, `deploy/proxmox/grafana/` |
| Deployment | LXC-Skripte, systemd, nginx | `deploy/proxmox/` |
| Tests | pytest im Backend, UI-Prüfskripte | `backend/tests/`, `tests/` |

App-Bereiche: Dashboard · Geräte · Steuerung · Verlauf · Diagnose · Integrationen · Doku sowie die Vorschauen
`/smartshunt-preview` und `/smartshunt-phase2`.

---

## 6. Projektstand (November 2026)

| Bereich | Stand |
|---|---|
| Live-Dashboard, Energiefluss, Tagesbilanz | produktiv |
| SmartShunt Phase 1 (Vorschau, nur lesen) | Hardwareabnahme am 05.11.2026 bestanden |
| SmartShunt Phase 2 (DC/AC-Trennung) | im Code gemergt (PR #82/#83), Test vor Ort an der Anlage offen |
| Trucki-Topic-Präfix `TRUCKI/` | angeglichen (PR #84) |
| Victron-MPPT- und Trucki/ZEPC-Einstellungen | als Empfehlungen dokumentiert, Eintrag von Hand, noch nicht vor Ort getestet |
| Grafana-Dashboards | Vorlagen vorhanden, Abgleich mit den echten Feldern offen |

### Offene Punkte

1. **Test vor Ort für Phase 2:** an echten Geräten die Oberfläche und die Werte in InfluxDB prüfen.
2. **Trucki-Steuerung gegen das Handbuch prüfen:** `MINPOWEROVR` steht nicht in der Liste der beschreibbaren Topics,
   und `REBOOTOVR` erwartet laut Handbuch die Payload `REBOOTOVR`, die App sendet `1`.
3. **Spannungsgrenzen an der Anlage prüfen:** Trucki 48,0/52,0 V, SUN 47,0/51,0 V, App-Warnung 47,5 V (bisher nur Vorschlag).
4. **Grafana:** Felder und Einheiten abstimmen, Dashboards automatisch einspielen (Provisionierung) und mit echten Abfragen testen.

---

## 7. Roadmap zum „SystemBoss“

- **Beobachten:** Gerätezustand, Alarme und Abweichungen zwischen den Quellen (SmartShunt, MPPT, Trucki) ständig überwachen.
- **Vergleichen:** Tages- und Wochenbilanz mit Effizienzbericht (PV-Ertrag, Eigenverbrauch, Autarkie).
- **Steuern:** abgesicherte Regelstrategien für Nulleinspeisung, Ladeschluss und Nachtbetrieb.
- **Zusammenführen:** gute Dashboard-Elemente aus der Schwester-App `Perspektivlos/Solar-App` per Vorschau übernehmen.
- **Pflegen:** regelmäßige technische Updates, Backups und Prüfung der Abhängigkeiten.

## 8. Arbeitsweise

1. Änderungen nur als Branch und PR, nie direkt auf `main`.
2. Neue Funktionen zuerst als Vorschau, die Hauptansicht ändert sich erst nach ausdrücklicher Freigabe.
3. Ein gemergter Code ist noch keine Abnahme an der Anlage: Tests mit Hardware und Oberfläche werden getrennt nachgewiesen.
4. Deploy auf CT 225 erst nach einem `vzdump`-Backup, danach Prüfung über `/api/live` und `/api/integrations/status`.

---

© 2026 T. Hauck · THCoding · siehe [`COPYRIGHT.md`](COPYRIGHT.md)
