# Frontend-Regeln für haucklab-fix (React-Dashboard)

Lies diese Datei, wenn ein Fix Dateien unter `frontend/` betrifft. Ersetzt den früheren
Agenten `frontend-specialist`.

## Zuständige Bereiche

- Seiten, Komponenten, Hooks unter `frontend/src/pages`, `frontend/src/components`, `frontend/src/hooks`
- API-Zugriff über `frontend/src/lib/api.js`, Leistungsformatierung über `frontend/src/lib/power.js`
- Routen `/verlauf`, `/steuerung`, `/geraete`, `/diagnose`, `/integrationen` bleiben erhalten

## Arbeitsregeln

1. Bei der eigentlichen Anzeige oder Route beginnen; vor dem UI-Fix API-Daten und Transformation prüfen.
2. Energie-Semantik nie im Frontend neu berechnen oder umdeuten.
3. Imports über den `@/`-Alias; bestehende funktionale Komponenten, Hooks, Tailwind, shadcn/Radix,
   `lucide-react` und Recharts verwenden.
4. Deutsche UI und Dark-Glass-/Neon-Design erhalten; semantische Farben für PV, Netz und Batterie.
5. Fehlende oder verzögerte Daten verständlich darstellen statt 0 W vorzutäuschen.
6. Große Dashboard-Komponenten nicht nur aus Stilgründen umbauen; `data-testid` stabil halten.
7. Nach der Änderung `yarn build`; bei Verhaltensänderung mit Testabdeckung zusätzlich
   `yarn test --watchAll=false`.
