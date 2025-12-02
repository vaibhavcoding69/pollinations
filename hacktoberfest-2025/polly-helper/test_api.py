"""Test script for Pollinations API integration."""

import asyncio
import sys

# Add parent directory to path for imports
sys.path.insert(0, '.')

from pollinations_client import pollinations_client


async def test_ai_response():
    """Test getting an AI response."""
    print("Testing AI response...")
    print("-" * 50)
    
    test_questions = [
        "How do I generate an image with the Pollinations API?",
        "I'm getting a 500 error from the API, what should I do?",
        "hello how are you today?",  # Should trigger [IGNORE]
        "what's the weather like?",  # Should trigger [IGNORE]
    ]
    
    for question in test_questions:
        print(f"\n📝 Question: {question}")
        print("-" * 30)
        response = await pollinations_client.get_ai_response(question)
        print(f"🤖 Response:\n{response[:500]}...")
        print()


async def test_api_health():
    """Test API health check."""
    print("\nTesting API health check...")
    print("-" * 50)
    
    health = await pollinations_client.check_api_health()
    
    for service, status in health.items():
        emoji = "✅" if status else "❌"
        print(f"{emoji} {service}: {'OK' if status else 'FAILED'}")


async def main():
    """Run all tests."""
    print("=" * 50)
    print("Pollinations Helper Bot - API Tests")
    print("=" * 50)
    
    await test_api_health()
    await test_ai_response()
    
    print("\n" + "=" * 50)
    print("Tests completed!")


if __name__ == "__main__":
    asyncio.run(main())