"""
WebSocket connection manager.
Manages per-project rooms for real-time broadcast.
"""
from __future__ import annotations
import json
from collections import defaultdict
from typing import Dict, Set, Any
from fastapi import WebSocket


class ConnectionManager:
    """
    Maintains a mapping of project_id → set of active WebSocket connections.
    Thread-safe for use in a single-process asyncio server.
    """

    def __init__(self):
        # project_id → set of WebSocket connections
        self._rooms: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, project_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms[project_id].add(ws)

    def disconnect(self, project_id: str, ws: WebSocket) -> None:
        self._rooms[project_id].discard(ws)
        if not self._rooms[project_id]:
            del self._rooms[project_id]

    async def broadcast(self, project_id: str, payload: Dict[str, Any]) -> None:
        """Send a JSON payload to all connections in a project room."""
        message = json.dumps(payload, default=str)
        dead: Set[WebSocket] = set()
        for ws in list(self._rooms.get(project_id, set())):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(project_id, ws)

    def room_size(self, project_id: str) -> int:
        return len(self._rooms.get(project_id, set()))


# Global singleton used across the app
ws_manager = ConnectionManager()
