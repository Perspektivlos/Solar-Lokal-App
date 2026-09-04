"""In-Memory-App-Wrapper für die lokale Entwicklung (VS Code / Proxmox-Test).

Ersetzt den echten MongoDB-Client durch einen In-Memory-Mock (mongomock-motor),
BEVOR `server.py` importiert wird. Dadurch läuft das komplette Backend ohne
installierte MongoDB – `server.py` selbst bleibt vollkommen unverändert.

Daten liegen nur im RAM und sind nach einem Neustart weg (reines Dev/Test-Setup).

Start:
    python run_local.py            # nutzt automatisch diesen Wrapper
    # oder direkt:
    uvicorn local_inmemory:app --app-dir backend
"""
from __future__ import annotations

import motor.motor_asyncio as _motor
from mongomock_motor import AsyncMongoMockClient

# Drop-in-Ersatz: server.py macht `from motor.motor_asyncio import AsyncIOMotorClient`.
# Wir patchen die Klasse am Modul, bevor server importiert wird.
_motor.AsyncIOMotorClient = AsyncMongoMockClient

from server import app  # noqa: E402  (Patch muss vor diesem Import laufen)

__all__ = ["app"]
