# QA Test Plan: Video Pipeline & Player

This document outlines the manual test procedures for validating the Studio Jenial video generation pipeline, player behavior, extension workflows, and storage integration.

**Scope:** Frontend Video Player (`VideoResult.tsx`), Backend Veo Integration, and Storage Layer.
**Version:** 1.0
**Last Updated:** 2025-12-08

---

## 1. Single Video Generation Test

**Objective:** Verify that a standard video generation request yields a playable video with correct UI states.

### Prerequisites
- Studio Jenial is running (`npm run dev` + `npm run server`).
- Valid Gemini API key is configured (Server-Managed or BYOK).

### Test Steps
1.  **Navigate** to the Studio Jenial main interface.
2.  **Enter Prompt** in the text area (e.g., "A futuristic city with flying cars, cinematic lighting").
3.  **Click** "Generate Video".
4.  **Observe** the loading state:
    *   Confirm a spinner or "Generating..." message appears.
    *   Confirm no immediate error toasts appear.
5.  **Wait** for generation to complete (typically 30-60s for Veo).

### Expected Results
*   **Success State:** The `VideoResult` component renders with the generated video.
*   **Playback:** Video auto-plays (or is ready to play) from 0:00 to end.
*   **Console:** No red errors in the browser console.
*   **Keyframes:**
    *   After a short delay (video loading + seeking), 5 keyframes should populate in the "Keyframe Refinement Assistant" panel (Right side).
    *   Hovering/Clicking a keyframe should update the timestamp or preview.
*   **Extension:** The "Extend with Assistant" button should become enabled (purple) once keyframes are extracted.

### Troubleshooting
*   *Issue:* Video doesn't load.
    *   *Check:* Network tab for `GET` request to the video URL.
    *   *Log:* Check terminal for `[Veo] Poll error` or `[Veo] Proxy error`.
*   *Issue:* Keyframes missing.
    *   *Check:* Console for "Failed to extract keyframes". Ensure video has loaded (`readyState >= 2`).

---

## 2. Video Extension from Uploaded File

**Objective:** Verify the "Extend Video" workflow starting from an existing user-uploaded file.

### Prerequisites
- A local video file (MP4, < 10MB, ~3-5 seconds duration).

### Test Steps
1.  **Click** "Start New Project" (if not on fresh state).
2.  **Upload** a video:
    *   Click the "Upload / Select File" area.
    *   Select your local test video.
3.  **Verify Upload:** The video preview appears.
4.  **Action:** Click the "Extend" or "Continue" action to set this video as the base for extension.
5.  **Enter Prompt:** Type a prompt for the extension (e.g., "Camera zooms in closer detailed").
6.  **Click** "Generate Extension".
7.  **Wait** for generation to complete.

### Expected Results
*   **Combined Playback:**
    *   The player should attempt to stitch the *Original Video* + *New Extension*.
    *   Total duration should be approx. Original Duration + Extension Duration.
    *   Playback should flow from Original -> Extension with minimal gap.
*   **Download:** Clicking "Download Combined Clip" should download a single merged file (video/mp4).
*   **Keyframes:** Keyframes should be extracted from the *newly generated extension* part (providing continuity options for the *next* step).

### Troubleshooting
*   *Issue:* "Stitching failed" in console.
    *   *Cause:* Incompatible codecs between uploaded file and Veo output.
    *   *Fallback:* Player should gracefully degrade to showing just the new extension (see Section 3).

---

## 3. MediaSource Fallback Behavior

**Objective:** Verify that the player handles incompatible video formats without crashing.

### Context
`VideoResult.tsx` uses `MediaSource` API to stitch the original video and the new extension for seamless preview. If codecs mismatch or `MediaSource` is unsupported (e.g., some mobile browsers), it falls back.

### Test Steps
1.  **Trigger Extension** (as per Test Case #2).
2.  **Simulate Failure** (or observe if natural failure occurs):
    *   *Hard to force manually without a specific "bad" file, but monitor logs if stitching fails.*
    *   *Scenario:* Upload a WebM file if possible (Veo output is MP4), or a high-profile H.265 MP4.
3.  **Observe Logs:** Look for:
    *   `[VideoResult] Falling back to extension-only playback`
    *   `MediaSource does not support any MIME variant...`

### Expected Behavior (Fallback Mode)
*   **No Crash:** The app remains stable.
*   **Playback:** The player shows *only* the newly generated extension video (not the combined sequence).
*   **UI Indicators:**
    *   "Download Combined Clip" might still attempt to combine them via Blob concatenation (which may result in a file that players handle variously), OR it downloads just the result. *Verify actual download content.*
    *   User can still see keyframes and continue the workflow.

---

## 4. Storage Validation

**Objective:** Ensure videos are correctly stored in the configured backend (Supabase) and URLs are valid.

### Prerequisites
- Access to the Supabase Project Dashboard (if evaluating backend).
- Browser Network Tab.

### Test Steps
1.  **Generate** a video (Single or Extension).
2.  **Inspect Network Request:**
    *   Look for the final API response returning the `videoUrl` or `publicUrl`.
    *   Click the "Download" button and inspect the URL of the download.
3.  **Supabase Validation:**
    *   **Dashboard:** Go to Supabase > Storage > `videos` bucket (or specific bucket name).
    *   **Check File:** Confirm a new file exists with a recent timestamp.
    *   **Metadata:** Check if `content-type` is `video/mp4`.
4.  **Google Drive (If Enabled):**
    *   If using Drive features, click "Save to Drive".
    *   **Verify:** Check your Google Drive "My Drive" for the new file.

### Expected Results
*   **URL Format:**
    *   Supabase: `https://[project-id].supabase.co/storage/v1/object/public/videos/...`
    *   Proxy/Veo Direct: `https://generativelanguage.googleapis.com/...` (if not persisting to storage immediately, depending on implementation stage).
*   **Access:** The URL should be accessible in a new browser tab without 403 Forbidden errors (storage objects should be public).

---

## 5. Keyframe Extraction & Assistant

**Objective:** Verify the "Extend with Assistant" workflow reliability.

### Test Steps
1.  **Generate** a video.
2.  **Wait** for keyframes to appear in the right sidebar.
3.  **Action:** Click on the **last** keyframe.
4.  **Result:** The interface should scroll/focus on the 'Prompt' area or open a modal (depending on current UI flow) with the keyframe selected as the "Input Image" for the next generation.
5.  **Refine Prompt:** The "Keyframe Refinement Assistant" (if active) should offer suggestions.

### Expected Results
*   Frame selection instantly updates the context for the next generation.
*   No "Canvas toBlob failed" errors in console.
*   Images should be clear (not black frames).
