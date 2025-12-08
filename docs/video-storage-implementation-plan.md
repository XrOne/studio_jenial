# Implementation Plan - Video Storage Refactor

Refactor the video storage layer to use a flexible `VideoStorageProvider` pattern on the backend, creating a robust foundation for future GCS/Drive support and centralized error handling.

## User Review Required

> [!IMPORTANT]
> This plan focuses on **backend infrastructure**. The frontend `geminiService.ts` currently handles uploads client-side. This plan creates a server-side "Upload from URI" capability that future frontend updates can leverage, satisfying the "backend files ONLY" constraint while delivering the requested storage architecture.

## Proposed Changes

### Storage Layer Architecture
Create a new `services/storage` module to house the provider pattern.

#### [NEW] `services/storage/types.ts`
- Define `VideoStorageProvider` interface.
- Define `StorageProvider` enum (Supabase, GCS, Drive, etc.).
- Define input/output types (`UploadOptions`, `UploadResult`).

#### [NEW] `services/storage/StorageFactory.ts`
- Singleton factory to register and retrieve storage providers.
- Logic to select provider based on configuration/env vars.

#### [NEW] `services/storage/providers/SupabaseStorage.ts`
- Implementation of `VideoStorageProvider` using `@supabase/supabase-js`.
- Logic to stream upload to Supabase Storage bucket.
- Error handling wrapping Supabase errors.

### Backend Integration

#### [MODIFY] `server.js`
- Initialize `StorageFactory` with `SupabaseStorage`.
- Add new endpoint `POST /api/storage/save-from-uri` (or similar).
    - Accepts `uri` (Veo video URL) and optional metadata.
    - Uses `StorageFactory` to get current provider.
    - Downloads video from `uri` (streaming).
    - Uploads to provider (streaming).
    - Returns public `videoUrl`.
- Add robust logging for this flow.

#### [DELETE] `docs/VideoStorageProvider.ts`
- Remove the draft file as it's being implemented.

## Verification Plan

### Automated Tests
- Create a test script `scripts/test-storage.js` to:
    1.  Mock a "Veo" video URL (or use a public sample video).
    2.  Call `StorageFactory` directly to upload to Supabase.
    3.  Verify the returned Public URL is accessible.
- Use `test-server.js` or `curl` to verify the new `/api/storage/save-from-uri` endpoint.

### Manual Verification
1.  Run `npm run start-server`.
2.  Execute `node scripts/test-storage.js`.
3.  Check Supabase dashboard (if possible) or verify the returned URL downloads the video.
