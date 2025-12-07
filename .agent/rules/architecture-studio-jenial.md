Studio Jenial – Architecture Rules

Context:
- This workspace is the "Studio Jenial" Veo/Gemini video studio.
- Stack: React + TypeScript (Vite) frontend, Node/Express backend (server.js), Supabase for persistence, deployed on Vercel.

Backend Architecture:
- The Node/Express backend (server.js and api/*) is the ONLY place allowed to call external AI APIs (Gemini/Veo) or Google Drive APIs.
- The backend must support TWO modes for Veo/Gemini:
  1) Server-managed key via GEMINI_API_KEY env var.
  2) BYOK mode via user-provided key in the x-api-key header.
- When GEMINI_API_KEY is defined, it MUST take precedence. BYOK is only used when no server key is configured.

Frontend Architecture:
- The frontend must never call Gemini/Veo or Google Drive APIs directly.
- The frontend talks ONLY to our backend endpoints (e.g. /api/video/*, /api/config, /api/google/drive/*).
- API keys must NEVER be stored or surfaced beyond localStorage in BYOK mode, and never logged.

State & Components:
- Use React functional components with Hooks only.
- Keep Studio.tsx as the main orchestrator for the Veo studio UI, delegating logic to smaller components (dialogs, forms, settings).

Supabase:
- Supabase is used for user data, presets and metadata, not for storing raw video/image files when Google Drive is enabled.
- Do not modify the Supabase schema or RLS policies unless explicitly requested.
