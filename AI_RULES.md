# AI Rules & Tech Stack Guide

## Tech Stack Overview
1. **React 19 + TypeScript** for the entire UI, bundled with **Vite** for rapid local development and easy Vercel deploys.  
2. **Tailwind CSS** provides all utility-first styling; no custom CSS frameworks should be introduced.  
3. **shadcn/ui components** are the default building blocks for reusable UI widgets, layered on top of Tailwind.  
4. **lucide-react** supplies the iconography set; create custom SVGs only when icons are missing from Lucide.  
5. **Supabase** handles authentication, storage (videos/images/thumbnails), and optional cloud persistence of user data.  
6. **Express (server.js)** exposes BYOK (Bring Your Own Key) proxy routes that forward requests to Google’s Gemini/Veo APIs.  
7. **Google Gemini API** powers all text, image, storyboard, and critique agents; keys are user-provided and stored client-side.  
8. **Vertex AI (optional)** can be called via the dedicated `/api/video/vertex/generate` route when users supply GCP credentials.  
9. **React Router (via App.tsx)** governs route handling—keep all route definitions centralized there.  
10. **LocalStorage hooks** (`useLocalStorage`, `useShotLibrary`) are used to persist user data when Supabase is unavailable.

## Library Usage Rules

### UI & Styling
- Use **Tailwind CSS** utility classes for layout, spacing, color, and typography.  
- Prefer **shadcn/ui** components for buttons, dialogs, dropdowns, tabs, etc.; create wrapper components instead of editing vendor files.  
- Icons must come from **lucide-react**; request additions rather than importing new icon packs.

### State & Data
- Keep reusable stateful logic inside custom hooks (e.g., `useShotLibrary`, `useLocalStorage`).  
- When Supabase is configured, use it for persistence; otherwise fall back to the local-storage hooks already provided.

### AI & Media
- **Gemini API** is the primary engine for prompts, images, storyboards, and critiques; always pass the user’s BYOK key via headers.  
- For large media uploads (images/video frames), route through the helper functions in `geminiService.ts` that leverage the Google Files API.  
- **Vertex AI** should only be used through `services/vertexVideoService.ts` and `/api/video/vertex/generate`; never call GCP endpoints directly from React.

### Backend
- All server-side logic lives in `server.js` (Express) or provider helpers (e.g., `providers/vertexProvider.ts`).  
- Do not store API keys on the server—respect BYOK: every request must include the `x-api-key` header supplied by the user.

### Routing & Structure
- Keep routes inside `App.tsx` and pages under `src/pages/`; components belong in `src/components/`.  
- New components or hooks must live in their own files (≤100 lines when practical) and be imported where needed—no large monolithic files.