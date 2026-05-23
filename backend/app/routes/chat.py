from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.services.chat_service import ChatService
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@router.post("", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    current_user=Depends(get_current_user)
):
    """
    Send a message to the AI chatbot and get a reply.
    Requires authentication.
    """
    if not request.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")
        
    try:
        reply = await ChatService.send_chat_message(request.message)
        return ChatResponse(reply=reply)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while processing the chat.")
