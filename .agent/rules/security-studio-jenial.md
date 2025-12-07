Studio Jenial – Security & Data Rules

API Keys & Secrets:
- Never hardcode Gemini, Veo or Google API keys in this repository.
- Never expose Supabase service role keys. Only use the public anon key on the frontend.
- Do not display raw keys in the UI, logs, or artifacts. Mask them when needed.

Veo / Gemini Usage:
- All Veo/Gemini requests must go through the backend which reads the API key using:
  1) process.env.GEMINI_API_KEY when present.
  2) Otherwise from the x-api-key header (BYOK).
- On authentication errors (401 / invalid key), backend must send structured error codes:
  - API_KEY_MISSING
  - API_KEY_INVALID
- The frontend must never silently loop to onboarding; it must display clear, user-friendly error messages.

Google Drive Integration:
- User media (videos, images, frames) should be stored on the user's Google Drive when connected.
- The backend must only store:
  - Metadata (fileId, webViewLink, timestamps, user_id).
- Never download or persist full media files on our server disk except as a transient stream from the source URL to Google Drive.
- Google OAuth tokens must be stored securely (e.g. encrypted database field) and never logged.

Destructive Operations:
- Do not implement any code path that deletes files or folders on the user's machine.
- For any irreversible migration or data change, always propose a plan and wait for explicit user approval.
