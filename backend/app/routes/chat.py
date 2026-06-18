from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.chat_service import ChatService
from app.dependencies.auth import get_current_user
from app.db.mongodb import get_database

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@router.post("", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Send a message to the AI chatbot and get a reply.
    Requires authentication.
    """
    if not request.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    try:
        reply = await ChatService.send_chat_message(request.message, current_user, db)
        return ChatResponse(reply=reply)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while processing the chat.")


@router.post("/stream")
async def stream_chat_message(
    request: ChatRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Stream the AI chatbot reply as plain-text chunks as they are generated.
    Requires authentication.
    """
    if not request.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    async def token_generator():
        try:
            async for chunk in ChatService.stream_chat_message(request.message, current_user, db):
                yield chunk
        except Exception:
            yield "\n[An error occurred while generating the response.]"

    return StreamingResponse(
        token_generator(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
