# Helicone Proxy Integration Issue

## Problem Summary
We are trying to integrate Helicone logging with our Pollinations text generation service, but the self-hosted Helicone proxy instance at `http://51.15.192.6:8585` is consistently returning authentication errors. We're unable to successfully proxy requests through the Helicone gateway to log our LLM usage.

## Current Environment Details
- **Pollinations Text Service**: Using Portkey as a gateway to multiple LLM providers
- **Self-hosted Helicone instance**: Running at `http://51.15.192.6:8585`
- **Helicone API Key**: `sk-helicone-mt2mjmy-orbep7y-tktosqq-dobdmeq`
- **Portkey API Key**: Available in application `.env` file

## Integration Attempts

### 1. Standard Helicone Gateway Proxy
We tried the standard approach for Helicone Cloud, using the gateway endpoint:

```bash
curl -X POST http://51.15.192.6:8585/gateway \
  -H "Content-Type: application/json" \
  -H "Helicone-Auth: Bearer sk-helicone-mt2mjmy-orbep7y-tktosqq-dobdmeq" \
  -H "Helicone-Target-Url: https://gateway.portkey.ai/v1/chat/completions" \
  -H "Authorization: Bearer ${PORTKEY_API_KEY}" \
  -H "x-portkey-api-key: ${PORTKEY_API_KEY}" \
  -H "x-portkey-virtual-key: openai-e5ebde" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

**Result**: `401 Unauthorized` with error message `{"error":"No API key found","trace":"isAuthenticated.error"}`

### 2. Direct Path to LLM Provider
We tried using the direct endpoint path format:

```bash
curl -X POST http://51.15.192.6:8585/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Helicone-Auth: Bearer sk-helicone-mt2mjmy-orbep7y-tktosqq-dobdmeq" \
  -H "Helicone-Target-Url: https://gateway.portkey.ai" \
  -H "Authorization: Bearer ${PORTKEY_API_KEY}" \
  -H "x-portkey-api-key: ${PORTKEY_API_KEY}" \
  -H "x-portkey-virtual-key: openai-e5ebde" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

**Result**: Same `401 Unauthorized` error

### 3. Helicone Cloud Format
We tried the format used for Helicone's cloud service:

```bash
curl --request POST \
    --url http://51.15.192.6:8585/oai/v1/chat/completions \
    --header "Authorization: Bearer sk-helicone-mt2mjmy-orbep7y-tktosqq-dobdmeq" \
    --header "Content-Type: application/json" \
    --header "Helicone-Auth: Bearer sk-helicone-mt2mjmy-orbep7y-tktosqq-dobdmeq" \
    --data '{
        "model": "gpt-3.5-turbo",
        "messages": [
            {
                "role": "system",
                "content": "Say Hello!"
            }
        ],
        "temperature": 1,
        "max_tokens": 10
    }'
```

**Result**: `404 Not Found` - The `/oai` endpoint doesn't exist on the self-hosted instance

## Alternative Approaches

We attempted several other variations:
- Using `Authorization` header instead of `Helicone-Auth`
- Different endpoint paths (`/`, `/gateway`, `/v1/chat/completions`, `/openai/v1/chat/completions`)
- Different header combinations

All attempts resulted in either `401 Unauthorized` or `404 Not Found` errors.

## Expected Behavior

Based on Helicone documentation, the proxy should:
1. Accept requests with proper authentication
2. Forward them to the target LLM provider
3. Log the request and response data
4. Return the response from the provider back to the client

## Questions for Helicone Instance Admin

1. Is the Helicone proxy configured to accept requests?
2. What is the correct authentication mechanism for this self-hosted instance?
3. Are there specific endpoints implemented on this instance?
4. Is the API key (`sk-helicone-mt2mjmy-orbep7y-tktosqq-dobdmeq`) registered and working?
5. Are there any firewall or network restrictions on the Helicone instance?

## Possible Solutions

1. **Fix the self-hosted proxy configuration**: Ensure proper authentication is set up and endpoints are correctly configured.

2. **Use async logging instead**: Implement direct logging to Helicone's API endpoints rather than using the proxy. This would mean:
   - Sending requests directly to the LLM provider
   - Logging requests and responses asynchronously to Helicone
   - Handling both streaming and non-streaming responses
   - Not relying on the proxy gateway

3. **Switch to Helicone Cloud**: Use Helicone's managed service at `https://oai.helicone.ai` instead of the self-hosted instance.

## Final Decision

After evaluating the options, we have decided to implement the **async logging approach** (solution #2). This decision was made because:

1. The proxy integration has persistent authentication issues with our self-hosted instance
2. Async logging is more resilient and doesn't affect the critical request/response path
3. It allows us to maintain full control over the logging process
4. We can implement proper handling for both streaming and non-streaming responses
5. This approach will work regardless of the state of the Helicone proxy

### Implementation Plan

We will:
1. Create a dedicated logging module for Helicone
2. Implement asynchronous logging functions for requests, responses, and streaming
3. Add logging calls at strategic points in the request handler
4. Ensure proper error handling so logging failures don't affect the user experience
5. Add configuration options through environment variables to enable/disable logging
