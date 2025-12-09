# Auto Motion Analysis

## Overview
The continuity modal now automatically analyzes motion between video frames using Gemini Vision, removing the need for manual description.

## How It Works

1. User uploads external video
2. Modal extracts first and last frames
3. **Auto-analysis** calls Gemini to describe the motion
4. Result populates the description field
5. User can edit or re-analyze with ✨ button

## Implementation

### New Function: `analyzeMotionBetweenFrames`

**Location**: `services/geminiService.ts`

```typescript
export const analyzeMotionBetweenFrames = async (
  firstFrame: ImageFile,
  lastFrame: ImageFile,
): Promise<string>
```

**Features**:
- Uses Gemini Flash (fast, economical)
- Compresses images to reduce payload
- Returns 2-3 sentence motion description
- Falls back gracefully on error

### VideoAnalysisModal Changes

**Location**: `components/VideoAnalysisModal.tsx`

- Added `isAnalyzing` state for loading spinner
- Auto-calls `analyzeMotionBetweenFrames` after frame extraction
- Added ✨ button to re-analyze manually
- Changed input to textarea for longer descriptions

## Console Logs

```
[MotionAnalysis] Analyzing motion between frames...
[MotionAnalysis] Result: "Travelling avant lent vers le sujet..."
```

## Cost

~$0.001 per analysis (~1€ for 1000 videos analyzed)
