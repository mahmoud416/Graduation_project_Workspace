from app.services.gemini_service import get_gemini_model

class ChatService:
    @staticmethod
    async def send_chat_message(message: str) -> str:
        """
        Sends a user message to the Gemini model and returns the AI's response.
        """
        try:
            model = get_gemini_model()
            # Generate content using Gemini
            response = await model.generate_content_async(message)
            return response.text
        except Exception as e:
            # Handle potential errors (e.g., API issues)
            raise ValueError(f"Failed to generate response: {str(e)}")
