Google Drive Storage Workflow

Goal:
Add optional Google Drive storage for user-generated media, without storing raw media on our servers.

Steps:
1. Inspect the backend (server.js and api/*) to see how video/image URLs are currently generated or stored.
2. Design a minimal Google Drive OAuth flow:
   - routes/googleDrive.js (or similar) with endpoints:
     - GET /api/google/drive/auth
     - GET /api/google/drive/callback
     - GET /api/google/drive/status
     - POST /api/google/drive/upload-from-url
   - Use user's Supabase user_id or existing auth ID as the key for storing tokens.
3. Implement upload-from-url:
   - Stream the media from a provided URL directly into Google Drive using the Drive API.
   - Do not store the file on disk; treat it as a pure stream.
   - Return fileId + webViewLink.
4. Add frontend UI hooks:
   - A "Connect Google Drive" button that calls /api/google/drive/auth or /status.
   - A "Save to Drive" button on generated media that calls /api/google/drive/upload-from-url.
   - Handle all error states gracefully and show confirmations.
5. Update or create docs/google-drive-setup.md explaining:
   - How to create OAuth credentials in Google Cloud Console.
   - Which env vars must be set on Vercel / local dev.
   - How privacy is handled (media not stored on our servers).
6. Ensure no existing BYOK logic is broken and run a quick verification plan.
