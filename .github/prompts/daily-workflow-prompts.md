# Daily Prompt Templates for Solar Lokal App

## 1) Root-cause debug prompt

"Analysiere die Ursache für [Fehler/Regression] in der Solar-Lokal-App. Verfolge den Datenfluss von [Quelle] über Parser/Aggregation bis zur [API/Anzeige]. Nenne die genaue Ursache, das betroffene Modul und den kleinsten sicheren Fix."

## 2) Backend fix prompt

"Behebe den Fehler in [backend/modul] ohne das Energiemodell zu verletzen. Halte API-Contract, lokale Semantik und MQTT/HTTP-Fallbacks stabil. Ergänze einen gezielten Test und führe den kleinsten relevanten Pytest-Lauf aus."

## 3) Frontend fix prompt

"Behebe die UI-/Komponentenfehler in [Komponente/Route]. Prüfe die API-Daten und die Visualisierung, halte das bestehende Design und die Semantik der Kennzahlen ein und validiere mit einem gezielten Frontend-Check."

## 4) Review prompt

"Prüfe den betroffenen Bereich auf Root Cause, semantische Konsistenz, API-Stabilität und lokale First-Logik. Stelle fest, ob der Fehler im Parser, in der Aggregation, im API-Layer oder in der UI-Ausgabe entsteht."

## 5) Agent workflow prompt

"Bewerte das aktuelle Agenten-Setup für dieses Repo. Prüfe Rollenabgrenzung, Prompt-Klarheit, Scope und Handlungsgrenzen zwischen Diagnose, Fix, Review und Spezialisten. Schlage gezielte Verbesserungen vor."

## 6) Validation prompt

"Validiere die Änderung mit dem kleinsten relevanten Check. Dokumentiere den Befehl, das Ergebnis und alle offenen Risiken. Achte dabei auf Energie-Semantik, API-Stabilität und lokale First-Verhalten."

## 7) Short daily checklist prompt

"Finde die Ursache, prüfe den Datenfluss, implementiere den kleinsten Fix, validiere mit dem nächsten relevanten Lauf und dokumentiere Risiko und Ergebnis."
