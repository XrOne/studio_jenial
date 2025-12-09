# External Video Extension Guide

## Overview
Veo's native EXTEND_VIDEO mode only works with Veo-generated videos. For external videos, we use a workaround: TEXT_TO_VIDEO with the last frame as startFrame.

## Flow Comparison

### Veo-Generated Video Extension
```
1. Generate video with Veo → stores video.uri
2. User clicks "Extend"
3. EXTEND_VIDEO mode with inputVideoObject.uri
4. Veo continues the video seamlessly
```

### External Video Continuation (Workaround)
```
1. User uploads external MP4
2. Continuity modal extracts last frame
3. User describes motion via Assistant
4. System detects external video
5. Converts to TEXT_TO_VIDEO + startFrame
6. Generates new video that visually continues
7. Server combines original + generated into single file
```

## Why This Works

The AI prompt contains:
- Last frame as visual anchor (`startFrame`)
- Motion description from analysis (`motionDescription`)
- Dogma style guidelines

Result: New video that visually continues the action.

## Files Involved

| File | Role |
|------|------|
| `Studio.tsx` | Detects external video, converts mode |
| `VideoAnalysisModal.tsx` | Extracts frames, analyzes motion |
| `geminiService.ts` | Includes motionDescription in prompt |
| `VideoResult.tsx` | Calls combine API for fusion |
| `api/video-combine.js` | Server-side video fusion |

## Console Logs

```
[External Video] Detected external video continuation request
[External Video] Using TEXT_TO_VIDEO mode with startFrame
[External Video] Converted to TEXT_TO_VIDEO with startFrame: { hasStartFrame: true }
```

## Limitations

- Not a true Veo extension (no motion physics continuity)
- Visual continuity via AI prompt approximation
- Requires compatible codecs for fusion
