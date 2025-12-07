# Google Drive Integration Setup

## Overview

Studio Jenial allows users to save generated videos/images directly to their Google Drive. No files are stored persistently on our servers.

## Prerequisites

1. Google Cloud project with OAuth consent screen configured
2. Google Drive API enabled
3. OAuth 2.0 credentials created

## Google Cloud Setup

### 1. Enable Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Library**
4. Search for "Google Drive API" and enable it

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose "External" for public apps
3. Add app information (name, email, etc.)
4. Add scope: `https://www.googleapis.com/auth/drive.file`
5. Add test users if in testing mode

### 3. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose "Web application"
4. Add authorized redirect URIs:
   - Local: `http://localhost:3001/api/google/drive/callback`
   - Production: `https://yourapp.com/api/google/drive/callback`
5. Save Client ID and Client Secret

## Environment Variables

Add these to your `.env.local` or server environment:

```bash
# Google Drive OAuth (optional - enables Drive integration)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/drive/callback
```

## Database Setup

Run the SQL migration in Supabase:

```bash
# In Supabase SQL Editor, run:
supabase-google-drive-setup.sql
```

This creates the `user_google_drive_tokens` table with RLS policies.

## User Flow

1. **Not Connected**: User sees "Connect Google Drive" button in video results
2. **Auth**: Click redirects to Google OAuth consent
3. **Callback**: Token stored in database, user redirected back
4. **Connected**: User sees "Save to Google Drive" button
5. **Upload**: Video streamed from source to Drive (no server storage)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/google/drive/enabled` | GET | Check if Drive is configured |
| `/api/google/drive/status` | GET | Check if user has connected |
| `/api/google/drive/auth` | GET | Start OAuth flow |
| `/api/google/drive/callback` | GET | OAuth callback |
| `/api/google/drive/upload-from-url` | POST | Upload file to Drive |

## Testing

### Test Drive Connection

1. Start server with Google credentials set
2. Open Studio and generate a video
3. Click "Connect Google Drive"
4. Complete Google OAuth flow
5. Verify redirect back to Studio

### Test Upload

1. Generate a video
2. Click "Save to Google Drive"
3. Check Google Drive for uploaded file

## Troubleshooting

### "DRIVE_NOT_CONFIGURED"
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set

### "DRIVE_NOT_CONNECTED"
- User hasn't completed OAuth flow
- Click "Connect Google Drive" to authorize

### OAuth Redirect Mismatch
- Verify redirect URI matches exactly in Google Console

### Token Expired
- System will auto-refresh using stored refresh_token
- If refresh fails, user needs to reconnect
