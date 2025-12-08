# Fix: Extension Assistant Payload Optimization

**Date:** 2024-12-08  
**Status:** Implemented

---

## Problem

When using the Extension Assistant flow (upload video → continuity modal → chat):
- The API payload was too large, causing 413 errors
- Every image in chat history was sent as base64
- The `motionDescription` from the continuity modal was NOT included in API calls

---

## Solution

### 1. Message Sanitization (`geminiService.ts`)

The `generateSequenceFromConversation` function now:
- **Keeps only TEXT** from chat history (no images in old messages)
- **Includes ONE visual anchor** at the end (the `extensionContext` or last image)
- **Logs payload summary** for debugging

```typescript
// Before: ALL images sent
const apiContents = messages.map(msg => {
  if (msg.image) parts.push({ inlineData: ... }); // ❌ Every image
});

// After: Only ONE anchor image
const apiContents = messages.map(msg => {
  if (msg.content) parts.push({ text: msg.content }); // ✅ Text only
});
if (visualAnchor) {
  apiContents.push({ parts: [{ inlineData: visualAnchor }] }); // ✅ One image
}
```

---

### 2. Motion Description Included (`geminiService.ts`)

Added `motionDescription` parameter to `generateSequenceFromConversation`:

```typescript
if (extensionContext && motionDescription) {
  contextInstruction += `
CONTINUITY CONTEXT (from video analysis): "${motionDescription}"
This describes the movement/direction from the original video.`;
}
```

---

### 3. Prop Chain Updated

| File | Change |
|------|--------|
| `PromptSequenceAssistantProps` | Added `motionDescription?: string \| null` |
| `PromptSequenceAssistant` | Destructure and pass to API |
| `Studio.tsx` | Pass `assistantMotionDescription` to component |

---

## Console Logs After Fix

```
[GenContent] Sanitized messages: {
  totalMessages: 5,
  textLength: 342,
  hasVisualAnchor: true,
  anchorImageSize: "156.2KB"
}
[ContentAPI] Incoming request: model=gemini-3-pro, size=168.4KB
```

**Before:** Size could be 5MB+ with multiple images  
**After:** Size is typically <500KB (text + one anchor)

---

## Files Modified

| File | Changes |
|------|---------|
| `services/geminiService.ts` | Message sanitization + motionDescription param |
| `components/PromptSequenceAssistant.tsx` | Added motionDescription prop + pass to API |
| `Studio.tsx` | Pass assistantMotionDescription prop |

---

## What Gets Sent to Google

| Field | Before | After |
|-------|--------|-------|
| Chat text | ✅ All | ✅ All |
| Old images | ❌ All base64 | ❌ Stripped |
| Visual anchor | ✅ Multiple | ✅ One only |
| Motion description | ❌ Not sent | ✅ In system instruction |
| Video data | ❌ Never | ❌ Never |
