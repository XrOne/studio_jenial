# Implementation Walkthrough: Veo Security + Google Drive Integration

## Overview

This document provides a high-level architecture overview of Studio Jenial's video generation and storage features:

1. **Veo/Gemini Integration** - AI video generation with dual-mode API key management
2. **Google Drive Integration** - Optional user-side storage for generated media

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                           │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────────┐  │
│  │ geminiService│  │ googleDrive    │  │ VideoResult.tsx       │  │
│  │ .ts          │  │ Client.ts      │  │ (UI for Drive save)   │  │
│  └──────┬───────┘  └───────┬────────┘  └───────────────────────┘  │
└─────────┼──────────────────┼───────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                          │
│  ┌──────────────────────┐    ┌─────────────────────────────────┐  │
│  │ server.js            │    │ googleDriveService.js           │  │
│  │ - /api/config        │    │ - OAuth2 flow                   │  │
│  │ - /api/video/*       │    │ - Token management              │  │
│  │ - /api/proxy-video   │    │ - uploadFileToDrive()           │  │
│  └──────────┬───────────┘    └────────────────┬────────────────┘  │
└─────────────┼─────────────────────────────────┼────────────────────┘
              │                                 │
              ▼                                 ▼
    ┌─────────────────┐              ┌─────────────────────┐
    │ Google Veo API  │              │ Google Drive API    │
    │ (Gemini 3.x)    │              │ + Supabase (tokens) │
    └─────────────────┘              └─────────────────────┘
```

---

## Veo/Gemini Flow

### Video Generation Sequence

```
USER                  FRONTEND                BACKEND                 VEO API
 │                        │                       │                       │
 │  Enter prompt          │                       │                       │
 │───────────────────────>│                       │                       │
 │                        │                       │                       │
 │                        │  GET /api/config      │                       │
 │                        │──────────────────────>│                       │
 │                        │  {hasServerKey:...}   │                       │
 │                        │<──────────────────────│                       │
 │                        │                       │                       │
 │                        │  POST /api/video/     │                       │
 │                        │  generate             │                       │
 │                        │  + x-api-key header   │                       │
 │                        │──────────────────────>│                       │
 │                        │                       │                       │
 │                        │                       │  predictLongRunning   │
 │                        │                       │──────────────────────>│
 │                        │                       │  {operationName}      │
 │                        │                       │<──────────────────────│
 │                        │                       │                       │
 │                        │  {operationName}      │                       │
 │                        │<──────────────────────│                       │
 │                        │                       │                       │
 │                        │  GET /api/video/      │                       │
 │                        │  status (poll)        │                       │
 │                        │──────────────────────>│  GET operation        │
 │                        │                       │──────────────────────>│
 │                        │                       │  {done, videoUri}     │
 │                        │                       │<──────────────────────│
 │                        │  {videoUri}           │                       │
 │                        │<──────────────────────│                       │
 │                        │                       │                       │
 │                        │  GET /api/proxy-video │                       │
 │                        │──────────────────────>│  Stream video         │
 │                        │  <video blob>         │<──────────────────────│
 │                        │<──────────────────────│                       │
 │                        │                       │                       │
 │  Video displayed       │                       │                       │
 │<───────────────────────│                       │                       │
```

### API Key Resolution

```javascript
// Priority order in server.js getApiKey()
1. process.env.GEMINI_API_KEY  // Server-managed (production)
2. req.headers['x-api-key']    // BYOK (user-provided)
3. throw API_KEY_MISSING       // Error
```

---

## Google Drive Flow

### OAuth Connection Sequence

```
USER                  FRONTEND                BACKEND              GOOGLE
 │                        │                       │                   │
 │  Click "Connect Drive" │                       │                   │
 │───────────────────────>│                       │                   │
 │                        │                       │                   │
 │                        │  Redirect to          │                   │
 │                        │  /api/google/drive/   │                   │
 │                        │  auth?userId=...      │                   │
 │                        │──────────────────────>│                   │
 │                        │                       │                   │
 │                        │                       │  Redirect to      │
 │                        │                       │  OAuth consent    │
 │<───────────────────────────────────────────────────────────────────│
 │                        │                       │                   │
 │  Approve access        │                       │                   │
 │────────────────────────────────────────────────────────────────────>│
 │                        │                       │                   │
 │                        │                       │  Callback with    │
 │                        │                       │  code             │
 │                        │                       │<──────────────────│
 │                        │                       │                   │
 │                        │                       │  Exchange for     │
 │                        │                       │  tokens           │
 │                        │                       │──────────────────>│
 │                        │                       │  {access_token,   │
 │                        │                       │   refresh_token}  │
 │                        │                       │<──────────────────│
 │                        │                       │                   │
 │                        │                       │  Save to Supabase │
 │                        │                       │                   │
 │  Redirect to /studio   │                       │                   │
 │<───────────────────────────────────────────────│                   │
```

### Upload Flow

```
USER                  FRONTEND                BACKEND              DRIVE API
 │                        │                       │                   │
 │  Click "Save to Drive" │                       │                   │
 │───────────────────────>│                       │                   │
 │                        │                       │                   │
 │                        │  POST /api/google/    │                   │
 │                        │  drive/upload-from-url│                   │
 │                        │  {fileUrl, fileName}  │                   │
 │                        │──────────────────────>│                   │
 │                        │                       │                   │
 │                        │                       │  Get tokens       │
 │                        │                       │  from Supabase    │
 │                        │                       │                   │
 │                        │                       │  Stream file      │
 │                        │                       │  to Drive         │
 │                        │                       │──────────────────>│
 │                        │                       │  {fileId, link}   │
 │                        │                       │<──────────────────│
 │                        │                       │                   │
 │                        │  {success, link}      │                   │
 │                        │<──────────────────────│                   │
 │                        │                       │                   │
 │  "Saved to Drive!"     │                       │                   │
 │<───────────────────────│                       │                   │
```

---

## Key Design Decisions

### 1. Dual-Mode API Key Management

| Decision | Rationale |
|----------|-----------|
| Server key takes priority | Production deployments should "just work" |
| BYOK as fallback | Enables beta testing without shared costs |
| Key validation (≥20 chars) | Quick sanity check before API call |
| localStorage for user keys | Browser-only, never sent to our servers for storage |

### 2. Zero Persistent Media Storage

| Decision | Implementation |
|----------|----------------|
| No server storage | Videos stream through, never saved to disk |
| Direct to Drive | `uploadFileToDrive()` uses stream-based upload |
| Minimal token storage | Only OAuth tokens in Supabase (encrypted) |

### 3. Minimal OAuth Scope

| Scope | Access |
|-------|--------|
| `drive.file` | Only files created by this app |
| (not `drive`) | Cannot access user's existing files |

---

## File Reference

| File | Purpose |
|------|---------|
| [server.js](file:///k:/studio_jenial/server.js) | Backend API endpoints, key resolution |
| [geminiService.ts](file:///k:/studio_jenial/services/geminiService.ts) | Frontend API calls, config caching |
| [googleDriveService.js](file:///k:/studio_jenial/services/googleDriveService.js) | Backend OAuth, token storage |
| [googleDriveClient.ts](file:///k:/studio_jenial/services/googleDriveClient.ts) | Frontend Drive API |
| [VideoResult.tsx](file:///k:/studio_jenial/components/VideoResult.tsx) | Drive UI integration |

---

## Related Documentation

- [Veo Setup Guide](./veo-setup.md) - Detailed API key configuration
- [Google Drive Setup](./google-drive-setup.md) - OAuth and env var setup
