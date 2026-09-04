# Solar Dashboard – Lokales Backend in VS Code starten

## 1. Voraussetzungen
- **Python 3.11+**
- **MongoDB** lokal auf `mongodb://localhost:27017` (oder MONGO_URL in `backend/.env` anpassen)
- (Optional) **VS Code** mit "Python"-Extension

## 2. Setup (einmalig)
```bash
cd /app
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
pip install uvicorn python-dotenv
```

## 3. Backend starten

### Variante A – Terminal
```bash
python run_local.py
```
→ Backend läuft auf `http://127.0.0.1:8001`, API unter `http://127.0.0.1:8001/api/…`.

### Variante B – VS Code Debug
1. VS Code im Ordner `/app` öffnen
2. Debug-Panel (`Ctrl+Shift+D`) → "Backend (FastAPI)" auswählen → **F5**
3. Breakpoints in `backend/server.py`, `routes.py`, `collectors.py` funktionieren direkt.

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
