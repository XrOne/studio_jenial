# Veo API Setup Guide

## Overview

Studio Jenial supports two modes for Gemini/Veo API key management:

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Server-Managed** | API key set in `GEMINI_API_KEY` env var | Production deployments with single key |
| **BYOK** | Users provide their own key | Beta testing, multi-tenant apps |

## Configuration

### Server-Managed Mode

Set the environment variable on your server or in `.env.local`:

```bash
GEMINI_API_KEY=AIzaSy...
```

When set, the frontend will skip the API key dialog entirely.

### BYOK Mode (Default)

If no `GEMINI_API_KEY` is set, users must provide their own key:

1. User clicks "Settings" or gets prompted on first visit
2. User enters their Gemini API key
3. Key is stored in browser localStorage
4. Key is sent to backend via `x-api-key` header

## Backend Endpoint: `/api/config`

The frontend calls `GET /api/config` to determine which mode is active:

```json
{
  "hasServerKey": true,
  "requiresUserKey": false
}
```

## Error Handling

| Error Code | HTTP Status | Meaning |
|------------|-------------|---------|
| `API_KEY_MISSING` | 401 | No key provided (BYOK mode) |
| `API_KEY_INVALID` | 401 | Key rejected by Google API |
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `INTERNAL_ERROR` | 500 | Server-side error |

### Frontend Behavior

- `API_KEY_MISSING` → Shows API key dialog with message
- `API_KEY_INVALID` → Shows dialog with "Invalid key" error
- `BAD_REQUEST` → Shows error in generation UI (no redirect)
- `INTERNAL_ERROR` → Shows retry message

## Testing

### Test Server Mode

```bash
# Set env and start server
GEMINI_API_KEY=AIzaSy... npm run dev

# Frontend should work without prompting for key
```

### Test BYOK Mode

```bash
# Start without env key
npm run dev

# Frontend should show API key dialog
# Enter key, verify generation works
```

### Smoke Test Script

```bash
node scripts/test-veo-smoke.mjs
```

## Troubleshooting

### "API key expired"
- Generate a new key at https://aistudio.google.com/app/apikey

### "Permission denied"
- Ensure key has access to Veo (may require waitlist approval)

### "Model not found"
- Verify using correct model name: `veo-3.1-fast-generate-preview`
