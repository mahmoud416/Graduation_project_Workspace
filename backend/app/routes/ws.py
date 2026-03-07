"""
WebSocket endpoint for real-time project updates.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.ws_manager import ws_manager
from app.core.security import decode_access_token

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/{project_id}")
async def project_websocket(
    project_id: str,
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    Open a WebSocket connection to a project room.

    Authentication:
        Pass JWT token as query param: ws://host/ws/{project_id}?token=<jwt>

    Events broadcast (JSON):
        {"event": "task_created",    "task": {...}}
        {"event": "task_updated",    "task_id": "...", "changes": {...}}
        {"event": "task_status",     "task_id": "...", "status": "REVIEW"}
        {"event": "comment_added",   "comment": {...}}
        {"event": "file_uploaded",   "file": {...}}
        {"event": "member_added",    "user_id": "..."}
        {"event": "progress_updated","progress": 72}
    """
    # Validate token before accepting the connection
    if token:
        payload = decode_access_token(token)
        if not payload:
            await websocket.close(code=4001)
            return

    await ws_manager.connect(project_id, websocket)
    try:
        while True:
            # Keep-alive: accept pings from client (ignored)
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(project_id, websocket)
