# Fix: 413 Error Handling in Extension Assistant

**Date:** 2024-12-08  
**Status:** Implemented

---

## Problem

When using the Extension Assistant, users would see:
```
"Sorry, I encountered an error: API Request Failed: 413"
```

With no indication of what 413 means or how to fix it.

**Root Cause:** When chat history contained large base64 images, the Google Generative Language API returned a 413 (Payload Too Large) error. This was passed through without interpretation.

---

## Solution

### 1. Backend: Enhanced Error Mapping (`server.js`)

The `/api/generate-content` endpoint now:
- Logs request size for debugging
- Maps error status codes to user-friendly codes and messages

```javascript
// Error codes returned:
// - PAYLOAD_TOO_LARGE (413): Context/images too large
// - QUOTA_EXCEEDED (429): API quota hit  
// - UNAUTHORIZED (401/403): Invalid API key
// - UPSTREAM_ERROR (5xx): Google service issue
// - INTERNAL_ERROR (default): Unknown error
```

Example response:
```json
{
  "error": "Request entity too large",
  "code": "PAYLOAD_TOO_LARGE",
  "message": "Le contexte de la conversation est trop volumineux..."
}
```

---

### 2. Frontend: Structured Error Parsing (`geminiService.ts`)

The `apiCall` function now:
- Parses structured errors from backend
- Preserves error code for UI handling
- Logs errors for debugging

---

### 3. UI: Friendly Error Messages (`PromptSequenceAssistant.tsx`)

The Assistant chat now displays contextual error messages with actionable tips:

| Error Code | Display Message |
|------------|-----------------|
| `PAYLOAD_TOO_LARGE` | ⚠️ ... + "Supprimez les images ou commencez une nouvelle conversation" |
| `QUOTA_EXCEEDED` | ⚠️ ... + "Attendez quelques minutes ou utilisez une autre clé API" |
| `UNAUTHORIZED` | 🔑 ... + "Vérifiez votre clé API dans les paramètres" |

---

## Console Logs

### Backend (`server.js`):
```
[ContentAPI] Incoming request: model=gemini-2.5-flash, size=1250.3KB
[ContentAPI] Error: { status: 413, message: "Request entity too large", code: undefined }
[ContentAPI] Payload too large - user should reduce context
[ContentAPI] Returning error to client { code: 'PAYLOAD_TOO_LARGE', status: 413, ... }
```

### Frontend (`geminiService.ts`):
```
[ContextAPI] Error from backend { status: 413, code: 'PAYLOAD_TOO_LARGE', message: '...' }
```

### UI Console (`PromptSequenceAssistant.tsx`):
```
[Assistant] Chat error { code: 'PAYLOAD_TOO_LARGE', message: '...' }
```

---

## Files Modified

| File | Changes |
|------|---------|
| `server.js` | Enhanced `/api/generate-content` with logging + error mapping |
| `services/geminiService.ts` | Updated `apiCall` to parse structured errors |
| `components/PromptSequenceAssistant.tsx` | Updated error display with tips |

---

## No Changes To

- `/api/video/generate` (Veo video generation)
- Video extension logic
- Supabase upload logic
- MediaSource stitching
