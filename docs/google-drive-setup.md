# Google Drive Integration Setup

## Overview

Studio Jenial allows users to save generated videos and images directly to their own Google Drive. This is an **optional** feature that requires OAuth2 setup.

> [!IMPORTANT]
> **Privacy by Design**: No generated media is stored persistently on our servers. Files are streamed directly from source to the user's Drive.

---

## Prerequisites

- Google Cloud project
- Google Drive API enabled
- OAuth 2.0 credentials (Web application type)
- Supabase project (for token storage)

---

## Google Cloud Setup

### Step 1: Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select or create a project
3. Navigate to **APIs & Services** → **Library**
4. Search for **"Google Drive API"**
5. Click **Enable**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (for public apps)
3. Fill in required fields:
   - App name: e.g., "Studio Jenial"
   - User support email: your email
   - Developer contact: your email
4. Click **Add or Remove Scopes**
5. Add scope: `https://www.googleapis.com/auth/drive.file`
6. Save and continue
7. Add test users (required while in "Testing" status)

> [!NOTE]
> The `drive.file` scope only allows access to files created by this app. Users' existing Drive files are never accessible.

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure authorized redirect URIs:

| Environment | Redirect URI |
|-------------|--------------|
| Local | `http://localhost:3001/api/google/drive/callback` |
| Vercel | `https://your-app.vercel.app/api/google/drive/callback` |
| Custom domain | `https://yourdomain.com/api/google/drive/callback` |

5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

---

## Environment Variables

Add these variables to your environment:

### Local Development (`.env.local`)

```bash
# Google Drive OAuth (optional - enables Drive integration)
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/drive/callback
```

### Vercel Deployment

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Your OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Your OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `https://your-app.vercel.app/api/google/drive/callback` |

3. Redeploy for changes to take effect

---

## Database Setup

The app stores OAuth tokens in Supabase. Run this SQL migration:

```sql
-- In Supabase SQL Editor, run the contents of:
-- supabase-google-drive-setup.sql
```

This creates the `user_google_drive_tokens` table with Row Level Security policies.

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User generates video in Studio                              │
│                    ↓                                             │
│  2. "Connect Google Drive" button appears                        │
│                    ↓                                             │
│  3. Click → Redirect to Google OAuth consent                    │
│                    ↓                                             │
│  4. User approves → Google redirects to callback                │
│                    ↓                                             │
│  5. Tokens saved to Supabase → User returns to Studio           │
│                    ↓                                             │
│  6. "Save to Google Drive" button now visible                   │
│                    ↓                                             │
│  7. Click → Video uploaded directly to user's Drive             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Flow

1. **Check if enabled**: Frontend calls `GET /api/google/drive/enabled`
   - Returns `{ enabled: true }` if credentials are configured
2. **Check connection**: Frontend calls `GET /api/google/drive/status` with auth token
   - Returns `{ connected: true/false }`
3. **Start OAuth**: User clicks "Connect" → redirects to `GET /api/google/drive/auth?userId=...`
4. **Google OAuth**: User sees consent screen, approves access
5. **Callback**: Google redirects to `/api/google/drive/callback?code=...&state=userId`
6. **Token exchange**: Backend exchanges code for access/refresh tokens
7. **Token storage**: Tokens saved to `user_google_drive_tokens` table
8. **Redirect**: User returns to `/studio?drive=connected`

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/google/drive/enabled` | GET | Check if Drive integration is configured |
| `/api/google/drive/status` | GET | Check if current user has connected Drive |
| `/api/google/drive/auth` | GET | Start OAuth flow (requires `userId` query param) |
| `/api/google/drive/callback` | GET | OAuth callback from Google |
| `/api/google/drive/upload-from-url` | POST | Upload file to user's Drive |

### Upload Request

```bash
POST /api/google/drive/upload-from-url
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "fileUrl": "https://...",
  "fileName": "my-video.mp4",
  "mimeType": "video/mp4"
}
```

### Upload Response

```json
{
  "success": true,
  "fileId": "1abc...",
  "webViewLink": "https://drive.google.com/file/d/1abc.../view"
}
```

---

## Limitations & Privacy

### What This App Can Do

| Capability | Enabled |
|------------|---------|
| Create new files in user's Drive | ✅ Yes |
| Read files created by this app | ✅ Yes |
| Store OAuth tokens securely | ✅ Yes (encrypted in Supabase) |

### What This App Cannot Do

| Capability | Status |
|------------|--------|
| Read user's existing Drive files | ❌ No |
| Delete any Drive files | ❌ No |
| Access Drive outside this app | ❌ No |
| Share files with others | ❌ No |

### Data Handling

- **No persistent server storage**: Generated videos are never saved on our servers
- **Stream-based upload**: Files stream directly from source URL to Drive
- **Token-only storage**: Only OAuth tokens are stored (required for API access)
- **User-controlled**: Users can revoke access anytime via [Google Account permissions](https://myaccount.google.com/permissions)

---

## Troubleshooting

### "DRIVE_NOT_CONFIGURED"

- **Cause**: Missing `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`
- **Fix**: Add both environment variables and restart/redeploy

### "DRIVE_NOT_CONNECTED"

- **Cause**: User hasn't completed OAuth flow
- **Fix**: Click "Connect Google Drive" button to authorize

### OAuth Redirect Mismatch Error

- **Cause**: Redirect URI in code doesn't match Google Console
- **Fix**: Ensure `GOOGLE_REDIRECT_URI` exactly matches the URI in Google Cloud Console
- Common issue: `http` vs `https`, trailing slashes, port numbers

### "SOURCE_DOWNLOAD_FAILED"

- **Cause**: Backend couldn't fetch the video from the source URL
- **Fix**: 
  - Check that the video URL is still valid (temp URLs expire)
  - Try regenerating the video and saving immediately

### Token Expired / "INVALID_TOKEN"

- **Cause**: Access token expired and refresh failed
- **Fix**: 
  - System auto-refreshes tokens, but if refresh_token is invalid, user must reconnect
  - Click "Connect Google Drive" again to reauthorize

### Upload Timeout

- **Cause**: Large files or slow network
- **Fix**: 
  - Check network connectivity
  - Try with a shorter video first
  - Vercel has a 10-second function timeout on hobby plan

---

## Testing

### Test Drive Connection

1. Start server with Google credentials:
   ```bash
   npm run start
   ```
2. Open Studio at http://localhost:5173
3. Generate a video
4. Click "Connect Google Drive"
5. Complete Google OAuth flow
6. Verify redirect back to Studio with `?drive=connected`

### Test Upload

1. After connecting, click "Save to Google Drive"
2. Check your [Google Drive](https://drive.google.com) for the uploaded file
3. File should appear in root or "Studio Jenial" folder

### Verify API Endpoints

```bash
# Check if Drive is enabled
curl http://localhost:3001/api/google/drive/enabled

# Expected: { "enabled": true }
```

---

## Related Documentation

- [Veo Setup](./veo-setup.md) - API key configuration
- [Veo + Drive Walkthrough](./veo-drive-walkthrough.md) - Architecture overview
