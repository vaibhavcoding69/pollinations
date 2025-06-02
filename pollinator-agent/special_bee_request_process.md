# Special Bee Request Process (Tier System)

## Overview
Special Bee requests are now explicitly a path to request **flower tier upgrades** for unlimited usage and SOTA models. Users first authenticate at auth.pollinations.ai to obtain seed tier access, then exceptional projects may be upgraded to flower tier.

**IMPORTANT: Follow the 95/5 rule**
- **95% of requests** should receive the standard response directing to auth.pollinations.ai
- **Only 5% of truly exceptional projects** should be flagged for flower tier review
- When in doubt, default to the standard response

## Tier System Overview

- 🌱 **Seed Tier**: Basic access after authentication at auth.pollinations.ai
- 🌸 **Flower Tier**: Unlimited usage, SOTA models, priority queue access
- 🍯 **Nectar Tier**: Revenue sharing (planned for 2026)

## Special Bee Request Process

### Step 1: Evaluate Request Quality
**DEFAULT: Give standard response unless project is truly exceptional**

- Check for live website with real users
- Verify professional team or established organization  
- Look for clear business model or educational value
- Assess potential for meaningful partnership
- Project must meet MULTIPLE criteria to qualify for flower tier

### Step 2: Choose Response Type

#### Standard Response (95% of requests):
```markdown
Hi @username! 👋

## 🌱 Get Immediate Access

1. **Register**: https://auth.pollinations.ai
2. **Sign in** with GitHub (@username)
3. **Get seed tier** with better rate limits
4. **Start creating** your AI content

## Next Steps
- Register for immediate access
- **Please close this issue** once you're successfully set up
- Request flower tier later if needed

Happy coding! 🐝
```

#### Exceptional Projects Only (5% of requests):
```markdown
Hi @username! 👋

## 🌱 Get Immediate Access

1. **Register**: https://auth.pollinations.ai
2. **Sign in** with GitHub (@username)
3. **Get seed tier** with better rate limits

## 🌸 Flower Tier Review
Your [project type] looks very promising! I'm flagging this for **flower tier** review which includes:
- Unlimited usage ⚡
- SOTA models 🤖
- Priority queue access 🚀

Please register first, then we'll follow up on the upgrade.

@thomash - Flagged for flower tier review - [brief reason]

Happy coding! 🐝
```

### Step 3: Ask User to Close Issue
After posting response, ask the user to close the issue to maintain queue hygiene.

---

## Legacy Process (Pre-Tier System)
### Step 1: Identify Valid Requests
- Search GitHub issues with `label:special-bee-request state:open`
- Verify each issue uses the proper template with required fields:
  - Project Name
  - Project Description
  - Project URL
  - Contact Information
  - Domain/Referrer to Approve

### Step 2: Evaluate Request Validity
- Check that the domain/token is appropriate (lowercase, simple)
- Ensure project appears legitimate
- If insufficient information, comment requesting details and keep open
- If clearly spam/inappropriate, close with explanation

### Step 3: Process Valid Requests
1. **Document the token in tokens_to_add.txt**:
   ```
   ## [Project Name] (Issue #XXXX)
   
   ### Project Description
   [Copy description from issue]
   
   ### Project URL
   [URL from issue]
   
   ### Domain/Referrer
   [token]
   ```

2. **Comment on the issue**:
   ```
   Your token `[token]` has been approved and will be added to our systems immediately. You can use this as your referer/token.
   
   ```
   [token]
   ```
   
   We're implementing an authentication system which will allow you to generate a token or an API key soon. Please re-open if you encounter any problems.
   
   **Please close this issue** once you've confirmed everything is working.
   ```

3. **Ask the user to close the issue**

### Step 4: Update Environment Files
Add the approved tokens to:

1. **text.pollinations.ai/.env**:
   - Locate `WHITELISTED_DOMAINS=` line
   - Add the new token to the comma-separated list

2. **image.pollinations.ai/.env**:
   - Locate `VALID_TOKENS=` line
   - Add the new token to the comma-separated list

### Step 5: Maintain Token Documentation
- Keep tokens_to_add.txt updated with all processed requests
- Maintain summary sections at the top:
  ```
  ### For text.pollinations.ai/.env (WHITELISTED_DOMAINS)
  - [list of all tokens]
  
  ### For image.pollinations.ai/.env (VALID_TOKENS)
  - [list of all tokens]
  ```

### Recent Processing Progress

**LATEST PROCESSED (June 2, 2025):**
26. **#2241 (LLMCHAT)** - STANDARD RESPONSE: Personal project without business model
27. **#2056 (MacanAIBot)** - STANDARD RESPONSE: Discord bot without clear business model
28. **#2238 (MultiAI)** - STANDARD RESPONSE: Multiple projects but insufficient proven traction
29. **#2237 (MultiAI duplicate)** - STANDARD RESPONSE: Duplicate issue
30. **#2038 (clipzap)** - STANDARD RESPONSE: Minimal information provided
31. **#2236 (MultiAI duplicate)** - STANDARD RESPONSE: Duplicate issue
32. **#2235 (MultiAI duplicate)** - STANDARD RESPONSE: Duplicate issue
33. **#2234 (MultiAI duplicate)** - STANDARD RESPONSE: Duplicate issue
34. **#2233 (MultiAI duplicate)** - STANDARD RESPONSE: Duplicate issue
35. **#2232 (MultiAI duplicate)** - STANDARD RESPONSE: Duplicate issue
36. **#2231 (JCode AI Chat)** - STANDARD RESPONSE: AI assistant platform without unique value proposition
37. **#1993 (AI Thumbnail Creator)** - STANDARD RESPONSE: Image generation tool without business model
38. **#1663 (Free AI Chatbot & Image Generator)** - STANDARD RESPONSE: Mobile app without unique value proposition

**PREVIOUS BATCH (May 31, 2025):**
15. **#2080 (GPT-API)** - STANDARD RESPONSE: Minimal description, personal use
16. **#2075 (AI brainrot image)** - STANDARD RESPONSE: Personal use, no GitHub repo
17. **#2084 (Wisdom-Core)** - FLAGGED for flower tier: Educational AI tutor with live website
18. **#2031 (ahmadi)** - STANDARD RESPONSE: Minimal "dev bot" description
19. **#2168 (MODA)** - STANDARD RESPONSE: Minimal description, no GitHub repo
20. **#1957 (EmojiAll Art)** - FLAGGED for flower tier: Professional platform with user base
21. **#2190 (UnrestrictedGPT)** - STANDARD RESPONSE: Discord bot, no URL/GitHub repo
22. **#2023 (GPT-4 Text Generator)** - STANDARD RESPONSE: No URL or GitHub repo
23. **#2022 (VoiceApp)** - STANDARD RESPONSE: Audio generation app, lacks business details
24. **#2091 (School District Query)** - FLAGGED for flower tier: Educational platform with existing website
25. **#2062 (pinblogai)** - FLAGGED for flower tier: Content creation tool with live website
26. **#2191 (bullnium)** - STANDARD RESPONSE: Personal education project, lacks business model
27. **#2189 (Pollinations Discord Bot)** - STANDARD RESPONSE: Discord bot without clear business model
28. **#2186 (IntraMind)** - FLAGGED for flower tier: Professional company with multiple AI services
29. **#2182 (Testing project)** - STANDARD RESPONSE: Explicitly for testing purposes only
30. **#2054 (A4F)** - STANDARD RESPONSE: API gateway without sufficient details for flower tier
31. **#2170 (GPT-Image Gallery)** - STANDARD RESPONSE: Personal project without business model
32. **#2168 (MODA)** - STANDARD RESPONSE: Minimal description, no GitHub repo
33. **#2165 (Nexoryx)** - STANDARD RESPONSE: Telegram bot without clear business model
34. **#2163 (AI Code Generator)** - STANDARD RESPONSE: Code generator without sufficient details for flower tier
35. **#2195 (AI Vtuber)** - STANDARD RESPONSE: Personal project without live website or business model
36. **#2092 (School District Query)** - FLAGGED for flower tier: Educational platform with existing website and scale potential
37. **#2093 (School District Query - Duplicate)** - DUPLICATE: Asked user to close this duplicate issue
38. **#2063 (PyrenzAI)** - STANDARD RESPONSE: Anime character chat without clear business model
39. **#2027 (AI Art Gallery)** - STANDARD RESPONSE: Minimal description, no website or GitHub repo
40. **#2026 (Chloe)** - STANDARD RESPONSE: Personal AI chatbot, doesn't meet business criteria for flower tier
41. **#1993 (AI Thumbnail Creator)** - STANDARD RESPONSE: YouTube thumbnail creator without clear business model or team
42. **#1534 (Science Encyclopedia/AI scienceQ)** - REOPENED & UPDATED: Previously approved token 'science-encyclopedia'; updated with standard response directing to auth.pollinations.ai
43. **#1489 (Mirexa AI)** - REOPENED & UPDATED: Previously approved token 'mirexa'; updated with standard response directing to auth.pollinations.ai
44. **#1590 (Automate Special Bee Request)** - INTERNAL TASK: Removed special-bee-request label and added automation label, not an actual Special Bee request
45. **#1592 (Pixpal)** - STANDARD RESPONSE: Chat with images application, directed to auth.pollinations.ai for seed tier access
46. **#1550 (DominiSigns)** - STANDARD RESPONSE: Dominican Sign Language Avatar Translator with accessibility focus, directed to auth.pollinations.ai for seed tier access
47. **#1553 (Neurix)** - STANDARD RESPONSE: Website offering access to various neural networks, directed to auth.pollinations.ai for seed tier access
48. **#1562 (ElxrAI)** - STANDARD RESPONSE: Described as a lovable.dev clone, directed to auth.pollinations.ai for seed tier access
49. **#1572 (AI Live)** - STANDARD RESPONSE: Voice-driven AI assistant, directed to auth.pollinations.ai for seed tier access
50. **#1574 (imag1ne)** - STANDARD RESPONSE: Updated image generation application with multi-image support, directed to auth.pollinations.ai for seed tier access
51. **#1581 (Afghanistan Educational Project)** - STANDARD RESPONSE: Educational content for underserved students with limited internet access, directed to auth.pollinations.ai for seed tier access
52. **#1589 (MieAiBot)** - STANDARD RESPONSE: Telegram AI chat bot with image generation capabilities, directed to auth.pollinations.ai for seed tier access
53. **#1600 (Define automation implementation)** - INTERNAL TASK: Not a Special Bee request, created by internal team member, no special-bee-request label
54. **#1607 (Raftar.xyz)** - FLOWER TIER RECOMMENDED: Discord bot with 10,000+ user installs and 650+ guild installs (reaching ~180k members), meets multiple criteria for flower tier consideration
55. **#1615 (Elixpo Art)** - FLOWER TIER RECOMMENDED: Web interface for creating thematic images with multiple aspect ratios and reference image support, has live website and GitHub repository
56. **#1617 (no project details)** - STANDARD RESPONSE: Empty Special Bee request with no project information, directed to auth.pollinations.ai for seed tier access
57. **#1618 (papitasfritas.com AI Tools Suite)** - FLOWER TIER RECOMMENDED: Comprehensive AI creative tools integration plan with detailed implementation strategy and website integration, shows thoughtful planning and clear vision
58. **#1630 (CoolThings)** - STANDARD RESPONSE: Minimal project information provided, directed to auth.pollinations.ai for seed tier access
59. **#1655 (AI Bullnium)** - STANDARD RESPONSE: Educational AI platform for village learning, directed to auth.pollinations.ai for seed tier access
60. **#1663 (Free AI Chatbot & Image Generator)** - STANDARD RESPONSE: Mobile app without unique features, directed to auth.pollinations.ai for seed tier access
61. **#1694 (Infinite World: AI game)** - STANDARD RESPONSE: Interactive graphic stories game without sufficient details for flower tier, directed to auth.pollinations.ai for seed tier access
62. **#1712 (Free AI Image Generator)** - STANDARD RESPONSE: Ad-supported image generation platform, lacks established business model or unique value proposition, directed to auth.pollinations.ai for seed tier access
63. **#1714 (A Story app based on AI)** - STANDARD RESPONSE: Personal mobile story app project with no live website, GitHub repo, or domain yet, directed to auth.pollinations.ai for seed tier access
64. **#1754 (AI Image Generator)** - STANDARD RESPONSE: Free image generation website with multiple features but no GitHub repo or clear business model, directed to auth.pollinations.ai for seed tier access
65. **#1755 (AI Image Generator [ROBLOX])** - STANDARD RESPONSE: Roblox-based AI image generator without public access or clear business model, directed to auth.pollinations.ai for seed tier access
66. **#1758 (mypicgen)** - STANDARD RESPONSE: Personal content creator tool for thumbnail generation without website or business model, directed to auth.pollinations.ai for seed tier access
67. **#1779 (AI Gatos)** - STANDARD RESPONSE: Minimal project details provided, no website, repository or domain information, directed to auth.pollinations.ai for seed tier access
68. **#2068 (GPT Project Official Bot)** - STANDARD RESPONSE: Telegram bot for AI interactions, lacks clear business model or unique value proposition, directed to auth.pollinations.ai for seed tier access
69. **#2054 (A4F)** - STANDARD RESPONSE: AI API gateway in development, has a demonstration web app but lacks established user base or unique indicators for flower tier, directed to auth.pollinations.ai for seed tier access
70. **#2053 (n8n automation)** - STANDARD RESPONSE: Personal learning project for N8N automation with OpenAI models, no website or repository provided, directed to auth.pollinations.ai for seed tier access
71. **#2049 (Yami bot)** - STANDARD RESPONSE: Free Telegram-based AI assistant for education and creativity, lacks business model or revenue potential, directed to auth.pollinations.ai for seed tier access
72. **#2195 (AI Vtuber)** - STANDARD RESPONSE: Personal VTuber project without website, business model, or proven track record, directed to auth.pollinations.ai for seed tier access
73. **#2015 (Image Generation Project)** - STANDARD RESPONSE: Personal testing project for image generation, no website or repository provided, directed to auth.pollinations.ai for seed tier access
74. **#2163 (AI Code Generator)** - STANDARD RESPONSE: Personal code generation project on websim.com without demonstrated business model or substantial user base, directed to auth.pollinations.ai for seed tier access
75. **#2092 (School District Query)** - FLAGGED FOR FLOWER TIER REVIEW: Educational platform with established website (xuexiao.duokuxinxi.com) integrating AI features, plans to scale to thousands of images per day with potential revenue model through premium features
76. **#2064 (Telebot)** - STANDARD RESPONSE: Personal Telegram bot project without website, business model, or substantial user base, directed to auth.pollinations.ai for seed tier access
77. **#2052 (Chatflix)** - STANDARD RESPONSE: Image generation application without detailed business model or demonstrated user base, directed to auth.pollinations.ai for seed tier access
78. **#2147 (Udeki.com)** - FLOWER TIER GRANTED: Educational platform with established website connecting administrators, teachers, parents, and students, with clear business model and professional team led by CEO
79. **#2084 (Wisdom-Core)** - FLAGGED FOR FLOWER TIER REVIEW: Educational AI tutor with live website (wisdomcore.netlify.app) and open source GitHub repository, flagged for potential educational impact
80. **#2137 (ABU AI)** - FLAGGED FOR FLOWER TIER REVIEW: Cross-platform AI assistant with image generation capabilities, available on desktop, mobile, and web (abuai.netlify.app), with promising multi-platform integration
81. **#2075 (AI brainrot image)** - STANDARD RESPONSE: Personal image generation project without website, business model, or substantial user base, directed to auth.pollinations.ai for seed tier access
82. **#2118 (YT-Vid-gen)** - STANDARD RESPONSE: YouTube video creation project for assembling images, without website, repository, or demonstrated business model, directed to auth.pollinations.ai for seed tier access
83. **#2170 (GPT-Image Gallery)** - STANDARD RESPONSE: Personal image generation project for creative and experimental purposes, without website, repository, or business model, directed to auth.pollinations.ai for seed tier access
84. **#2199 (MrEgonAI)** - STANDARD RESPONSE: Simple UI for image generation with multiple models on Vercel, without demonstrated substantial user base or unique business model, directed to auth.pollinations.ai for seed tier access
85. **#2136 (AI image generator)** - STANDARD RESPONSE: Personal AI image generator project without details on website, business model, or user base, directed to auth.pollinations.ai for seed tier access
86. **#2132 (AI Image Weaver)** - STANDARD RESPONSE: Simple image generation tool with minimal project information and no demonstrated user base or business model, directed to auth.pollinations.ai for seed tier access
87. **#2123 (AIDA Discord Bot)** - STANDARD RESPONSE: Open-source Discord bot with 400 beta users in testing, good documentation of safety measures, but no public repository yet, directed to auth.pollinations.ai for seed tier access
88. **#2094 (School District Query)** - CLOSED AS DUPLICATE: Identical to issue #2092, same project (xuexiao.duokuxinxi.com) and requester, directed user to original issue

### Response Style Improvements:
- **Concise format** based on user feedback
- **Direct @username mentions** for personalization
- **Numbered steps** for clarity
- **Emoji usage** (🌱🌸🐝⚡🤖🚀) for visual appeal
- **@thomash flagging** for promising projects

### Flagging Criteria for Flower Tier:
**⚠️ BE VERY SELECTIVE - Most requests should get standard responses**

Only flag for flower tier if the project meets **MULTIPLE** of these strict criteria:
- **Proven traction**: Live website with existing users/traffic
- **Business model**: Clear revenue potential or commercial application
- **Professional team**: Company/organization with established presence
- **High-value use case**: Educational institutions, enterprise tools, or significant innovation
- **Partnership potential**: Could lead to meaningful collaboration or showcase value

**RED FLAGS - Do NOT flag:**
- Personal projects or hobby apps
- Discord bots without clear business model
- Minimal descriptions or "testing" purposes
- No live website or GitHub repository
- Individual developers without proven track record
- Generic AI assistants without unique value proposition

**DEFAULT APPROACH**: When in doubt, give standard response directing to auth.pollinations.ai

## Token Guidelines
- Use lowercase for new tokens
- Keep tokens simple, preferably matching the domain
- Maintain original casing for previously communicated tokens
- Both text and image services should have identical token lists

## Handling Internal Tasks
- Remove the `special-bee-request` label from internal tasks
- Comment explaining the label removal
- Use appropriate alternative labels (e.g., "Analytics")

## Deployment
- After processing batches of requests, manually restart services or notify DevOps
- No need to restart services after each individual token addition

## Troubleshooting
- If users report issues, verify token is properly added to both environment files
- Check for typos or case sensitivity issues
- For Cloudflare-related issues, may need to run tunnel cleanup and restart

## Metrics
- Track number of requests processed
- Document types of projects using the service
- Note any patterns in usage or request volume
- Current metrics:
  - Processed: 38 requests in recent batches
  - Standard responses: ~90% (approaching target 95%)
  - Flower tier flagging: ~10% (approaching target 5%)
  - Common project types: Discord bots, educational tools, content generation, personal projects, AI assistants, mobile apps
  - Multiple duplicate submissions identified (7 duplicate submissions from same user)
  - Now asking users to close their own issues rather than closing for them
