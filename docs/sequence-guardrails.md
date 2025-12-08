# Sequence Extension Guardrails

## Summary

This document describes the 4 guardrails implemented to ensure the Prompt Sequence UX behaves like a film set: you **NEVER** shoot an extension if the previous shot isn't in the can.

## Guardrails

### Guardrail 1: Block Extension Without Base Video

Extensions are **strictly blocked** if the previous shot has no valid video URI.

**Implementation:** `Studio.tsx` → `handleGenerate`

```typescript
if (currentPromptIndex > 0) {
  const baseVideoUri = sequenceVideoData[currentPromptIndex - 1]?.video?.uri;
  if (!baseVideoUri) {
    console.warn(`[Sequence] Cannot generate extension index=${currentPromptIndex}: missing base video`);
    setErrorMessage(`The previous shot (Shot ${currentPromptIndex}) is not ready yet...`);
    return; // BLOCK - do not proceed
  }
}
```

---

### Guardrail 2: Mode Must Match Situation

The generation mode is **forced** based on the shot index:

| Shot | Mode | Base Video |
|------|------|------------|
| Root (index 0) | `TEXT_TO_VIDEO` | None |
| Extension (index > 0) | `EXTEND_VIDEO` | Required from previous |

**Console output:**
```
[Sequence] Root shot index=0 → mode=TEXT_TO_VIDEO (no base video)
[Sequence] Extension index=1 → mode=EXTEND_VIDEO, baseVideoUri=https://...
```

---

### Guardrail 3: Prevent "Too Early" Clicks

The "Use" button in `SequenceManager.tsx` is **disabled** when:
- The previous shot is not done (no video data)

When disabled:
- Button shows grayed out with `cursor-not-allowed`
- Tooltip shows reason: "Generate Shot X first"

---

### Guardrail 4: Clear Chain Logging

Console shows a clear **staircase** of the generation chain:

```
[Sequence] Root shot index=0 → mode=TEXT_TO_VIDEO (no base video)
[Veo] Text-to-video mode (no base video)
[Sequence] Stored root video for index=0: { uri: "https://..." }

[Sequence] Preparing extension index=1 with base video from index=0: { uri: "https://..." }
[Sequence] Extension index=1 → mode=EXTEND_VIDEO, baseVideoUri=https://...
[Sequence] Calling generateVideo for extension index=1 with mode=EXTEND_VIDEO and baseVideoUri=https://...
[Veo] Extend mode enabled with base video: https://...
[Sequence] Stored extension video for index=1: { uri: "https://..." }
```

---

## How to Verify

### Test 1: Block Extension Without Root

1. Create a sequence with Main Prompt + Extension 1
2. Without generating root shot, try to click "Use" on Extension 1
3. **Expected:** Button is disabled, cannot select

### Test 2: Block Generation Without Base Video

1. Somehow trigger generate for Extension 1 without root shot
2. **Expected:** Error message shown, generation blocked
3. **Console:** `[Sequence] Cannot generate extension index=1: missing base video for index=0`

### Test 3: Verify Chain Logging

1. Generate root shot, then Extension 1, then Extension 2
2. **Console shows staircase:** root → ext 1 → ext 2, each with base video logged

---

## Result

It is now **IMPOSSIBLE** to:
- ❌ Start an extension if the previous shot has no video
- ❌ Generate an extension in text-to-video mode
- ❌ "Pretend" to extend without a real base video

Visual continuity is **technically enforced** at the code level.
