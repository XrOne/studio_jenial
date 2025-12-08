# Fix: Extension Video Data Flow for Uploaded External Videos

**Date:** 2024-12-08  
**Status:** Implemented

---

## Summary

Fixed the bug where extension videos generated from an uploaded external video (via the Assistant Prompt flow) would have no visual continuity with the original clip and "Download Combined Clip" would only contain the original 8s.

## Problem Description

When using the "Assistant Prompt" flow starting from an uploaded root video (external media, camera icon):
- Logs showed: Veo video ready, downloaded, uploaded to Supabase
- On the "Continuity Engine Result" screen:
  - The player was blank or only knew about the root shot
  - "Download Combined Clip" contained ONLY the original 8s, not the +8s extension
- The extension video was generated and stored, but had no visual continuity with the original

## Root Cause

When extending from an **uploaded external video**:
1. The video file was stored in `originalVideoForExtension` (for MediaSource stitching in player)
2. **But it was never uploaded to Google Files API**
3. Veo received no `videoUri` reference, so it generated a completely new text-to-video instead of extending the original

## Solution

### 1. Studio.tsx

**Added import**:
```typescript
import {
  // ... existing imports
  uploadToGoogleFiles,
} from './services/geminiService';
```

**Added external video upload logic** (in `handleGenerate`, around line 564-603):
```typescript
// ═══════════════════════════════════════════════════════════════════
// EXTERNAL VIDEO EXTENSION: Upload video to Google Files API if needed
// ═══════════════════════════════════════════════════════════════════
if (
  effectiveParams.mode === GenerationMode.EXTEND_VIDEO &&
  originalVideoForExtension?.file &&
  !effectiveParams.inputVideoObject?.uri
) {
  console.log('[Sequence/Extend] Starting extension from uploaded external video', {
    rootVideoName: originalVideoForExtension.file.name,
    rootVideoSize: `${(originalVideoForExtension.file.size / 1024 / 1024).toFixed(2)} MB`,
    extensionPrompt: effectiveParams.prompt,
  });

  try {
    setAppState(AppState.LOADING);
    setErrorMessage(null);
    console.log('[Sequence/Extend] Uploading external root video to Google Files API...');

    const uploadResult = await uploadToGoogleFiles(
      originalVideoForExtension.file,
      originalVideoForExtension.file.name
    );

    console.log('[Sequence/Extend] External video uploaded successfully:', uploadResult.fileUri);

    // Update effectiveParams with the uploaded video URI
    effectiveParams = {
      ...effectiveParams,
      inputVideoObject: { uri: uploadResult.fileUri },
    };
  } catch (uploadError) {
    console.error('[Sequence/Extend] Failed to upload external video:', uploadError);
    showStatusError('Failed to upload the external video for extension. Please try again.');
    setAppState(AppState.IDLE);
    return;
  }
}
```

---

### 2. geminiService.ts

**Enhanced logging** (around line 391-399):
```diff
- console.log(`[Sequence] Generating extension with mode=ExtendVideo, baseVideo=${videoUri}`);
+ console.log(`[Sequence/Extend] Generating extension with baseVideo=${videoUri}`);

- console.log('[Sequence] Generating extension (no baseVideo URI - will be text-to-video)');
+ console.warn('[Sequence/Extend] WARNING: EXTEND_VIDEO mode but no baseVideo URI! Will generate as text-to-video instead of true extension.');
```

---

## Expected Console Logs After Fix

When extending from an uploaded external video, you should see:

```
[Sequence/Extend] Starting extension from uploaded external video {rootVideoName: "my-clip.mp4", rootVideoSize: "12.34 MB", ...}
[Sequence/Extend] Uploading external root video to Google Files API...
[GoogleFiles] Starting upload: my-clip.mp4 (12.34 MB)
[GoogleFiles] Upload URL received, uploading file...
[GoogleFiles] Upload complete: https://generativelanguage.googleapis.com/...
[Sequence/Extend] External video uploaded successfully: https://generativelanguage.googleapis.com/...
[Sequence/Extend] Generating extension with baseVideo=https://generativelanguage.googleapis.com/...
[Veo] Starting video generation...
```

---

## How to Test

1. **Upload an 8s video** using the camera icon (external media)
2. **Use Assistant Prompt** to describe an extension
3. **Generate** the extension video
4. **Verify in Console**: Look for the `[Sequence/Extend]` logs showing the upload
5. **Verify in Continuity Engine**: The player should show the stitched video
6. **Test Download Combined Clip**: File should be ~16s (8s original + 8s extension)

---

## Files Modified

| File | Lines Changed |
|------|---------------|
| `Studio.tsx` | +42 lines (import + upload logic) |
| `geminiService.ts` | 2 logging changes |

---

## No Regression Risk

The new upload logic **only triggers when**:
- Mode is `EXTEND_VIDEO`
- `originalVideoForExtension.file` exists (external video uploaded)
- `inputVideoObject.uri` is missing (not already uploaded)

This means:
- ✅ Normal text-to-video flows unaffected
- ✅ Normal "Extend with Assistant" from generated video unaffected (already has URI)
- ✅ Prompt Sequence flows unaffected (use `sequenceVideoData` for base videos)
