# Nano Banana Pro - Documentation Technique Complète

> **Dernière mise à jour** : 2025-12-13

## Vue d'ensemble

Nano Banana Pro étend Studio Jenial avec des capacités de storyboarding visuel et d'alignement prompt/image. L'objectif : **voir → retoucher → appliquer → générer Veo**.

---

## Architecture

```mermaid
graph TD
    subgraph "Frontend - React"
        STUDIO[Studio.tsx] --> |nanoEditorContext| AIE[AIEditorModal]
        STUDIO --> |storyboardModalContext| SPM[StoryboardPreviewModal]
        STUDIO --> |openNanoEditor| PEM[PromptEditorModal]
        STUDIO --> |openNanoEditor| VR[VideoResult]
        STUDIO --> |openNanoEditor| PC[PromptConception]
        AIE --> |onApply| HNA[handleNanoApply]
        SPM --> |onApplyVariant| HNA
        HNA --> |update| PS[promptSequence]
        HNA --> |update| SBBI[storyboardByIndex]
    end
    
    subgraph "Backend - API"
        API[/api/nano/*] --> MOCK[MockNanoProvider]
        API -.-> REAL[RealNanoProvider - TODO]
    end
```

---

## Fichiers

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `api/nano/index.js` | Endpoints mock: `/preview`, `/retouch`, `/shot-variants` |
| `services/nanoService.ts` | Frontend service + helpers |
| `components/StoryboardPreviewModal.tsx` | Modal 12 vignettes |

### Fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| `types.ts` | +`NanoApplyPayload`, `NanoEditorContext`, `StoryboardPreview`, `ShotVariant`, `STANDARD_SHOT_LIST` |
| `Studio.tsx` | +`nanoEditorContext`, `storyboardByIndex`, `storyboardModalContext`, `openNanoEditor`, `handleNanoApply`, `sortedSequenceHistory` |
| `components/AIEditorModal.tsx` | +`onApply`, `segmentIndex`, `target`, `initialPrompt`, bouton "Appliquer Prompt" |
| `components/PromptEditorModal.tsx` | +`onOpenNanoEditor`, bouton "Aligner au visuel (Nano)" |
| `components/VideoResult.tsx` | +`onRecalNano`, `promptSequence`, `activePromptIndex`, bouton "Recaler avec Nano" |

---

## Types Clés

### NanoApplyPayload
```typescript
interface NanoApplyPayload {
  target: 'root' | 'extension' | 'character';
  segmentIndex: number | null;  // null = character, 0 = root, 1..N = extensions
  previewPrompt: string;
  previewImage: ImageFile;
  cameraNotes?: string;
  movementNotes?: string;
}
```

### NanoEditorContext
```typescript
interface NanoEditorContext {
  segmentIndex: number | null;
  target: 'root' | 'extension' | 'character';
  dogma: Dogma | null;
  baseImage?: ImageFile;
  initialPrompt?: string;
}
```

### ShotVariant
```typescript
interface ShotVariant {
  label: string;               // "Plan moyen", "Plan épaule", etc.
  previewImage: ImageFile;
  cameraNotes: string;
  deltaInstruction: string;
}
```

---

## Convention d'Indices (CRITIQUE)

| segmentIndex | Target | Accès |
|--------------|--------|-------|
| `null` | character | N/A |
| `0` | root | `mainPrompt` |
| `1` | extension 1 | `extensionPrompts[0]` |
| `2` | extension 2 | `extensionPrompts[1]` |
| `N` | extension N | `extensionPrompts[N-1]` |

### Helpers (nanoService.ts)

```typescript
deriveTarget(segmentIndex)          // null→character, 0→root, ≥1→extension
deriveDirtyExtensions(count)        // Returns [1, 2, ..., N] (NOT [0..N-1])
getEffectiveDogma(seqBound, active) // sequenceBoundDogma ?? activeDogma
```

---

## Controller Central (Studio.tsx)

### States

```typescript
const [nanoEditorContext, setNanoEditorContext] = useState<NanoEditorContext | null>(null);
const [storyboardByIndex, setStoryboardByIndex] = useState<Record<number, StoryboardPreview>>({});
const [storyboardModalContext, setStoryboardModalContext] = useState<{
  segmentIndex: number;
  baseImage: ImageFile;
} | null>(null);
```

### openNanoEditor()

Ouvre AIEditorModal avec le contexte approprié :

```typescript
openNanoEditor({
  segmentIndex: 0,           // ou 1..N, ou null pour character
  baseImage: thumbnailImage,
  initialPrompt: currentPrompt,
});
```

### handleNanoApply(payload)

| Target | Action |
|--------|--------|
| `root` | MAJ `mainPrompt`, `dirtyExtensions=[1..N]`, `storyboardByIndex[0]` |
| `extension` | MAJ `extensionPrompts[idx-1]`, retrait du dirty, `storyboardByIndex[idx]` |
| `character` | TODO |

### sortedSequenceHistory

Garantit l'ordre stable de la timeline :

```typescript
const sortedSequenceHistory = useMemo(() => {
  return Object.entries(sequenceVideoData)
    .map(([k, v]) => ({ idx: Number(k), v }))
    .filter(x => Number.isFinite(x.idx))
    .sort((a, b) => a.idx - b.idx)
    .map(x => x.v);
}, [sequenceVideoData]);
```

---

## Flows UX

### 1. Stylet → Nano

```
PromptEditorModal (stylet)
    ↓ clic "Aligner au visuel (Nano)"
AIEditorModal
    ↓ retouche image
    ↓ clic "Appliquer Prompt"
handleNanoApply()
```

### 2. Drift Control

```
VideoResult (après génération extension)
    ↓ clic "Recaler avec Nano" (visible si activePromptIndex ≥ 1)
AIEditorModal (avec dernier keyframe)
    ↓ instruction recadrage
    ↓ clic "Appliquer Prompt"
handleNanoApply()
```

### 3. Thumbnail Retouche

```
PromptConception (Sequence Flow)
    ↓ hover thumbnail → bouton "Nano" (orange)
AIEditorModal
    ↓ clic "Appliquer Prompt"
handleNanoApply()
```

### 4. 12 Vignettes

```
Trigger (à venir: bouton dans UI)
    ↓ StoryboardPreviewModal s'ouvre
    ↓ clic "Générer 12 Plans"
    ↓ génération via /api/nano/shot-variants
    ↓ hover vignette → "Utiliser ce plan"
handleNanoApply()
```

---

## Badges Preview (PromptConception)

| Badge | Couleur | Condition |
|-------|---------|-----------|
| **OK** | vert | `storyboardByIndex[segmentIndex]` existe |
| **⚠** | orange | `segmentIndex ≥ 1` et `dirtyExtensions.includes(segmentIndex)` |
| **—** | gris | sinon (missing) |

---

## Backend Endpoints

| Endpoint | Description | Status |
|----------|-------------|--------|
| `POST /api/nano/preview` | Génère preview depuis prompt | Mock ✅ |
| `POST /api/nano/retouch` | Retouche image avec instruction | Mock ✅ |
| `POST /api/nano/shot-variants` | Génère 12 variantes de plan | Mock ✅ |

**Flag** : `USE_MOCK_PROVIDER = true` (api/nano/index.js)

---

## 12 Plans Standard (STANDARD_SHOT_LIST)

1. Plan d'ensemble
2. Demi-ensemble
3. Plan moyen
4. Plan genoux
5. Plan américain
6. Plan taille
7. Plan poitrine
8. Plan épaule
9. Gros plan
10. Très gros plan
11. Plongée
12. Contre-plongée

---

## Prochaines Étapes

- [ ] Timeline I/O/X : keybinds I/O/X pour marqueurs EDL
- [ ] Characters : couverture de plans + Nano

---

## Tests d'Acceptance

| Test | Expected |
|------|----------|
| Stylet root → Nano → Apply | Root MAJ, dirty=[1..N] |
| Stylet ext2 → Nano → Apply | Ext2 MAJ, ext2 retiré du dirty |
| Drift control ext2 | AIEditorModal avec keyframe, ext2 MAJ |
| Timeline ordre | root→ext1→ext2... stable |
| Thumbnail hover | Bouton "Nano" visible |
| Badge dirty | ⚠ affiché si extension dirty |
| 12 vignettes | Génération + "Utiliser" fonctionne |
