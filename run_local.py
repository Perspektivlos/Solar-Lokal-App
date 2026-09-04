#!/usr/bin/env python3
"""Lokaler Dev-Runner für das Solar-Dashboard-Backend.

Startet das FastAPI-Backend aus VS Code (Run/Debug oder Terminal).

STANDARD: In-Memory-Datenbank (KEINE MongoDB-Installation nötig!).
Die App bleibt unverändert – der MongoDB-Client wird nur für den lokalen
Start durch einen In-Memory-Mock ersetzt (siehe backend/local_inmemory.py).
Daten liegen im RAM und sind nach einem Neustart weg (reines Dev/Test-Setup).

Nutzung:
    # Terminal (In-Memory, ohne MongoDB):
    python run_local.py

    # Mit echter MongoDB (falls lokal vorhanden):
    USE_REAL_DB=1 python run_local.py

    # VS Code Debug:
    Wähle die Konfiguration "Backend (In-Memory)" in .vscode/launch.json.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

ROOT = Path(__file__).parent.resolve()
BACKEND = ROOT / "backend"

# .env laden (MONGO_URL, DB_NAME, CORS_ORIGINS)
load_dotenv(BACKEND / ".env")

# backend/ auf den Import-Pfad legen, damit `server`, `routes`, ... auffindbar sind
sys.path.insert(0, str(BACKEND))

HOST = os.environ.get("BACKEND_HOST", "127.0.0.1")
PORT = int(os.environ.get("BACKEND_PORT", "8001"))
RELOAD = os.environ.get("BACKEND_RELOAD", "1") not in ("0", "false", "False")

# In-Memory ist Standard; USE_REAL_DB=1 nutzt die echte MongoDB via server:app
USE_REAL_DB = os.environ.get("USE_REAL_DB", "0") in ("1", "true", "True")
APP_TARGET = "server:app" if USE_REAL_DB else "local_inmemory:app"
DB_MODE = "Echte MongoDB" if USE_REAL_DB else "In-Memory (kein MongoDB nötig)"


def main() -> None:
    print(f"→ Solar Dashboard Backend startet auf http://{HOST}:{PORT}")
    print(f"   DB-Modus  = {DB_MODE}")
    if USE_REAL_DB:
        print(f"   MONGO_URL = {os.environ.get('MONGO_URL', '(nicht gesetzt)')}")
        print(f"   DB_NAME   = {os.environ.get('DB_NAME', '(nicht gesetzt)')}")
    print(f"   Reload    = {RELOAD}")
    print("   API-Root  = /api/")
    print()

    uvicorn.run(
        APP_TARGET,
        host=HOST,
        port=PORT,
        reload=RELOAD,
        reload_dirs=[str(BACKEND)] if RELOAD else None,
        app_dir=str(BACKEND),
    )


if __name__ == "__main__":
    main()
