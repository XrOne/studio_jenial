Veo Security Refactor Workflow

Goal:
Safely refactor Veo/Gemini integration to support dual API key mode and improved error handling without breaking existing features.

Steps:
1. Read server.js, services/geminiService.ts, Studio.tsx, components/ApiKeyDialog.tsx and docs/veo-setup.md if present.
2. Confirm that getApiKey(req) in server.js:
   - Uses process.env.GEMINI_API_KEY when defined.
   - Falls back to x-api-key header for BYOK mode.
   - Throws a specific API_KEY_MISSING error when no key is available.
3. Ensure a GET /api/config endpoint exists and returns { hasServerKey, requiresUserKey }.
4. In the frontend:
   - Implement a config service to fetch /api/config once and cache it.
   - Only require the ApiKeyDialog when requiresUserKey === true and no valid local key exists.
   - Replace any onboarding loops with explicit error states:
     - API_KEY_MISSING -> ask for key.
     - API_KEY_INVALID -> show error and allow user to re-enter key.
5. Add or update tests / manual test plan to verify:
   - Server-managed mode works without any key dialog.
   - BYOK mode works when no GEMINI_API_KEY is set.
   - Error states are user friendly.
6. Produce an Implementation Plan and a short Walkthrough summary of changes.
