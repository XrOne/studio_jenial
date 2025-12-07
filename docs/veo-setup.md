# Veo API Setup Guide

## Overview

Studio Jenial uses Google's Veo 3.x models for AI video generation. The application supports **two modes** for API key management:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Server-Managed** | Single API key set via `GEMINI_API_KEY` env var | Production deployments, teams |
| **BYOK (Bring Your Own Key)** | Each user provides their own key | Beta testing, multi-tenant apps, public demos |

> [!TIP]
> In Server-Managed mode, users never see an API key dialog. In BYOK mode, users must enter their key on first visit.

---

## Configuration

### Mode 1: Server-Managed Key

Set the `GEMINI_API_KEY` environment variable on your server. When present, the backend uses this key for all requests.

#### Local Development

Create `.env.local` in your project root:

```bash
GEMINI_API_KEY=AIzaSy...your-key-here
```

#### Vercel Deployment

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add `GEMINI_API_KEY` with your API key value
3. Set scope to **Production** (and optionally Preview/Development)
4. Redeploy for changes to take effect

When `GEMINI_API_KEY` is set:
- `/api/config` returns `{ hasServerKey: true, requiresUserKey: false }`
- Frontend skips the API key dialog entirely
- All API calls use the server key automatically

---

### Mode 2: BYOK (Default)

If no `GEMINI_API_KEY` is set, the application operates in BYOK mode:

1. User visits the Studio
2. Frontend calls `/api/config` → gets `{ hasServerKey: false, requiresUserKey: true }`
3. App shows API key dialog
4. User enters their Gemini API key (get one at [aistudio.google.com](https://aistudio.google.com/app/apikey))
5. Key is stored in browser `localStorage` under key `gemini_api_key`
6. All API requests include the key via `x-api-key` header

> [!NOTE]
> Keys are stored **only** in the user's browser. The backend never persists user keys.

---

## Backend Endpoint: `/api/config`

The frontend calls this endpoint on startup to determine which mode is active.

**Request:** `GET /api/config`

**Response:**
```json
{
  "hasServerKey": true,
  "requiresUserKey": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `hasServerKey` | boolean | `true` if `GEMINI_API_KEY` env is set and valid (≥20 chars) |
| `requiresUserKey` | boolean | `true` if user must provide their own key |

**Frontend Logic:**
```typescript
const config = await fetch('/api/config').then(r => r.json());
if (config.requiresUserKey && !localStorage.getItem('gemini_api_key')) {
  showApiKeyDialog();
}
```

---

## API Key Priority

The backend resolves the API key with this priority:

1. **`GEMINI_API_KEY`** environment variable (if set and ≥20 chars)
2. **`x-api-key`** request header (BYOK mode)
3. Return `API_KEY_MISSING` error

```javascript
// From server.js
const getApiKey = (req) => {
  if (process.env.GEMINI_API_KEY?.trim().length >= 20) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const userKey = req.headers['x-api-key'];
  if (userKey?.trim().length >= 20) {
    return userKey.trim();
  }
  throw { code: 'API_KEY_MISSING', statusCode: 401 };
};
```

---

## Error Handling

### Backend Error Codes

| Error Code | HTTP Status | Cause | Backend Action |
|------------|-------------|-------|----------------|
| `API_KEY_MISSING` | 401 | No key available in BYOK mode | Return error JSON |
| `API_KEY_INVALID` | 401 | Key rejected by Google API | Return error JSON |
| `BAD_REQUEST` | 400 | Invalid request parameters | Return error with details |
| `INTERNAL_ERROR` | 500 | Server-side failure | Log and return generic error |

### Frontend UI Behavior

| Error | UI Response |
|-------|-------------|
| `API_KEY_MISSING` | Shows API key dialog with message: "Please enter your API key" |
| `API_KEY_INVALID` | Shows dialog with error: "Invalid API key. Please check and try again" |
| `BAD_REQUEST` | Shows error message in generation UI (no redirect) |
| `INTERNAL_ERROR` | Shows retry message with option to try again |

---

## Troubleshooting

### "API key expired" / "API_KEY_INVALID"

- Generate a new key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- Clear the old key from localStorage: `localStorage.removeItem('gemini_api_key')`
- Enter the new key in the dialog

### "Permission denied" / "Model not found"

- Ensure your API key has access to Veo models
- Veo access may require waitlist approval from Google
- Verify model name is correct: `veo-3.1-fast-generate-preview`

### "API_KEY_MISSING" in Server-Managed mode

- Check that `GEMINI_API_KEY` is set in your environment
- Verify the key is at least 20 characters long
- On Vercel: ensure the env var is set for the correct scope (Production/Preview)
- Restart your server or redeploy after adding the variable

### Video generation times out

- Veo generation can take 30-120 seconds depending on complexity
- The app polls every 5 seconds, with a 10-minute timeout
- Check server logs for `[Veo] Polling...` messages

### 400 BAD_REQUEST errors

Common causes:
- Empty or missing prompt text
- Invalid aspectRatio value (use `16:9`, `9:16`, or `1:1`)
- Invalid resolution value (use `720p` or `1080p`)

---

## Testing

### Test Server-Managed Mode

```bash
# Set env and start server
GEMINI_API_KEY=AIzaSy... npm run start

# Verify: /api/config should return hasServerKey: true
curl http://localhost:3001/api/config

# Frontend should NOT show API key dialog
```

### Test BYOK Mode

```bash
# Start without env key
npm run start

# Verify: /api/config should return requiresUserKey: true
curl http://localhost:3001/api/config

# Frontend should show API key dialog on first visit
```

### Smoke Test Script

```bash
node scripts/test-veo-smoke.mjs
```

---

## Related Documentation

- [Google Drive Setup](./google-drive-setup.md) - Save videos to user's Drive
- [Veo + Drive Walkthrough](./veo-drive-walkthrough.md) - Architecture overview
