"""Pollinations API client for the helper bot using enter.pollinations.ai."""

import aiohttp
import json
from config import POLLINATIONS_API_BASE, POLLINATIONS_API_KEY, SYSTEM_PROMPT


class PollinationsClient:
    """Client for interacting with enter.pollinations.ai API."""

    def __init__(self):
        self.base_url = POLLINATIONS_API_BASE
        self.api_key = POLLINATIONS_API_KEY

    async def get_ai_response(self, user_message: str, conversation_history: list = None) -> str:
        """
        Get an AI response using enter.pollinations.ai OpenAI-compatible endpoint.
        
        Args:
            user_message: The user's question or issue
            conversation_history: Optional list of previous messages for context
            
        Returns:
            AI-generated response string
        """
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Add conversation history if provided
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": user_message})

        headers = {"Content-Type": "application/json"}

        payload = {
            "model": "openai",
            "messages": messages
        }

        # enter.pollinations.ai OpenAI-compatible endpoint
        url = f"{self.base_url}/api/generate/v1/chat/completions"
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=60) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        error_text = await response.text()
                        return f"I'm having trouble connecting to the API right now. Error: {response.status} - {error_text[:200]}"
                        
        except aiohttp.ClientTimeout:
            return "The API request timed out. This might indicate a server-side issue. Please try again in a moment."
        except Exception as e:
            return f"An error occurred while processing your request: {str(e)}"

    async def check_api_health(self) -> dict:
        """
        Check the health of enter.pollinations.ai API.
        
        Returns:
            Dict with status information
        """
        results = {
            "api_reachable": False,
            "image_models": False,
            "text_models": False
        }

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with aiohttp.ClientSession() as session:
            # Check image models endpoint
            try:
                async with session.get(f"{self.base_url}/api/generate/image/models", headers=headers, timeout=10) as response:
                    results["image_models"] = response.status == 200
                    if response.status == 200:
                        results["api_reachable"] = True
            except:
                pass

            # Check text models endpoint
            try:
                async with session.get(f"{self.base_url}/api/generate/v1/models", headers=headers, timeout=10) as response:
                    results["text_models"] = response.status == 200
                    if response.status == 200:
                        results["api_reachable"] = True
            except:
                pass

        return results


# Singleton instance
pollinations_client = PollinationsClient()