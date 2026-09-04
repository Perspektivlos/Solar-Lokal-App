#!/usr/bin/env python3
"""Lokaler Dev-Runner für das Solar-Dashboard-Backend.

Startet das FastAPI-Backend aus VS Code (Run/Debug oder Terminal).
Lädt automatisch backend/.env und startet uvicorn mit --reload.

Nutzung:
    # Terminal:
    python run_local.py

    # VS Code Debug:
    Wähle die Konfiguration "Backend (FastAPI)" in .vscode/launch.json.
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


def main() -> None:
    print(f"→ Solar Dashboard Backend startet auf http://{HOST}:{PORT}")
    print(f"   MONGO_URL = {os.environ.get('MONGO_URL', '(nicht gesetzt)')}")
    print(f"   DB_NAME   = {os.environ.get('DB_NAME', '(nicht gesetzt)')}")
    print(f"   Reload    = {RELOAD}")
    print("   API-Root  = /api/")
    print()

    uvicorn.run(
        "server:app",
        host=HOST,
        port=PORT,
        reload=RELOAD,
        reload_dirs=[str(BACKEND)] if RELOAD else None,
        app_dir=str(BACKEND),
    )


if __name__ == "__main__":
    main()
