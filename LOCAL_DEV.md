# Solar Dashboard – Lokales Backend in VS Code starten

## 1. Voraussetzungen
- **Python 3.11+**
- **KEINE MongoDB nötig** – der lokale Start nutzt standardmäßig eine In-Memory-DB.
- (Optional) **VS Code** mit "Python"-Extension

> Die App selbst bleibt unverändert. Nur für den lokalen Start wird der
> MongoDB-Client durch einen In-Memory-Mock ersetzt (`backend/local_inmemory.py`).
> Daten liegen im RAM und sind nach einem Neustart weg – ideal für Dev/Test.

## 2. Setup (einmalig)
```bash
cd /app
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
pip install uvicorn python-dotenv
```
> `mongomock-motor` (In-Memory-DB) ist in `backend/requirements.txt` enthalten.

## 3. Backend starten

### Variante A – Terminal (In-Memory, ohne MongoDB)
```bash
python run_local.py
```
→ Backend läuft auf `http://127.0.0.1:8001`, API unter `http://127.0.0.1:8001/api/…`.

### Variante B – VS Code Debug
1. VS Code im Ordner `/app` öffnen
2. Debug-Panel (`Ctrl+Shift+D`) → **"Backend (In-Memory)"** auswählen → **F5**
3. Breakpoints in `backend/server.py`, `routes.py`, `collectors.py` funktionieren direkt.

### Mit echter MongoDB (falls lokal vorhanden)
```bash
USE_REAL_DB=1 python run_local.py
```
oder in VS Code die Konfiguration **"Backend (Echte MongoDB)"** wählen.
`MONGO_URL` / `DB_NAME` kommen dann aus `backend/.env`.

## 4. Konfigurations-Overrides (optional)
Umgebungsvariablen vor dem Start setzen:
```bash
BACKEND_HOST=0.0.0.0 BACKEND_PORT=8001 BACKEND_RELOAD=1 python run_local.py
```

## 5. Frontend gegen lokales Backend
`frontend/.env` temporär anpassen:
```
REACT_APP_BACKEND_URL=http://127.0.0.1:8001
```
Dann `cd frontend && yarn start`.
