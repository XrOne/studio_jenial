# Server-Side Video Fusion for External Continuations

## Overview
When extending an **external video** (uploaded MP4), the browser-side MediaSource stitching fails due to codec incompatibility. This document describes the server-side fusion implementation.

## Problem
- MediaSource API requires compatible codecs between video segments
- External videos often have different encoding than Veo-generated videos
- Result: "Failed to append buffers" error, black screen

## Solution

### New Endpoint: `/api/video/combine`

**Location**: `api/video-combine.js`

**Request**:
```json
{
  "originalBlob": "base64-encoded-video",
  "extensionUrl": "https://...supabase.co/.../veo-generated.mp4"
}
```

**Response**:
```json
{
  "combinedUrl": "https://...supabase.co/storage/.../combined_xxx.mp4"
}
```

### Flow

```
1. Frontend detects external video + extension
2. Sends original (base64) + extension (URL) to /api/video/combine
3. Server downloads extension, decodes original
4. Concatenates buffers
5. Uploads to Supabase videos/combined/
6. Returns public URL
7. Frontend uses simple <video src={combinedUrl}> player
```

## Files Modified

| File | Change |
|------|--------|
| `api/video-combine.js` | [NEW] Server-side combine endpoint |
| `components/VideoResult.tsx` | Replaced MediaSource with API call |

## Console Logs

### Frontend
```
[ContinuityResult] External video detected, requesting server-side fusion...
[ContinuityResult] Sending to /api/video/combine...
[ContinuityResult] Using combined clip: https://...
```

### Backend
```
[VideoCombine] Request received: { hasOriginalBlob: true, hasExtensionUrl: true }
[VideoCombine] Extension size: 8.45 MB
[VideoCombine] Original size: 12.30 MB
[VideoCombine] Combined size: 20.75 MB
[VideoCombine] Uploading to Supabase: combined/combined_1702156800000.mp4
[VideoCombine] Success! Combined URL: https://...
```

## Limitations

- Simple buffer concatenation works for compatible MP4s (same codec)
- For different codecs, FFmpeg would be needed (not implemented)
- Large videos may timeout on Vercel (50s limit)

## Related
- [Payload Optimization](./fix-extension-payload-optimization.md)
- [Veo Setup Guide](./veo-setup.md)
