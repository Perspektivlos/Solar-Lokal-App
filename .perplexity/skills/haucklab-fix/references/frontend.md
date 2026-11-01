# Frontend-Regeln (React-Dashboard)

Lies diese Datei, wenn der Fix Dateien unter `frontend/` betrifft.

## Zuständige Bereiche

- Seiten, Komponenten, Hooks unter `frontend/src/pages`, `frontend/src/components`, `frontend/src/hooks`
- API-Zugriff über `frontend/src/lib/api.js`, Leistungsformatierung über `frontend/src/lib/power.js`

## Arbeitsregeln

1. Bei der eigentlichen Anzeige oder Route beginnen; vor dem UI-Fix API-Daten und Transformation prüfen.
2. Energie-Semantik nie im Frontend neu berechnen oder umdeuten.
3. Bestehende `solar-ui`-Komponenten, `lib/power.js`, Radix/shadcn-Primitives und Recharts verwenden.
4. Deutsche UI und visuelle Sprache erhalten: Dark-Glass-Control-Room-Stil, semantische Farben für
   PV, Netz und Batterie. Schriften laut `design_guidelines.json`: IBM Plex Sans für Text,
   JetBrains Mono für Zahlenwerte.
5. Fehlende oder verzögerte Daten verständlich darstellen statt 0 W vorzutäuschen.
6. Große Dashboard-Komponenten nicht nur aus Stilgründen umbauen; `data-testid` stabil halten.
7. Nach der Änderung `yarn build` ausführen; bei Verhaltensänderung mit Testabdeckung zusätzlich
   `yarn test --watchAll=false`. Bei UI-Änderungen responsives Verhalten und Konsolenfehler prüfen,
   wenn ein Browser verfügbar ist.
