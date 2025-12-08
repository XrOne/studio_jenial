# Plan d'Implémentation : Guardrails pour Extensions de Séquence

## Vue d'ensemble

Ajouter des garde-fous solides au flux de Prompt Sequence pour empêcher la génération d'extensions sans vidéo de base valide. L'UX doit se comporter comme un plateau de tournage : on ne filme jamais une extension si le plan précédent n'est pas dans la boîte.

---

## Guardrail 1 : Bloquer l'Extension Sans Vidéo de Base

### Emplacement : `Studio.tsx` → `handleGenerate`

Ajouter une validation au début de `handleGenerate` qui vérifie :
- Si c'est une extension (index > 0)
- Le plan précédent a une `video.uri` valide
- Sinon, bloquer et afficher une erreur

```typescript
// Dans handleGenerate, après avoir déterminé currentPromptIndex
if (currentPromptIndex > 0) {
  const baseVideo = sequenceVideoData[currentPromptIndex - 1]?.video;
  if (!baseVideo?.uri) {
    console.warn(`[Sequence] Cannot generate extension index=${currentPromptIndex}: missing base video for index=${currentPromptIndex - 1}`);
    setErrorMessage('The previous shot is not ready yet. Please generate or wait for the previous video before creating this extension.');
    return; // BLOCK - do not proceed
  }
}
```

---

## Guardrail 2 : Forcer la Correspondance des Modes

### Emplacement : `Studio.tsx` → `handleGenerate`

Après la vérification de la vidéo de base, forcer :
- Plan racine (index 0) doit utiliser TEXT_TO_VIDEO
- Extensions (index > 0) doivent utiliser EXTEND_VIDEO avec inputVideoObject valide

```typescript
if (currentPromptIndex === 0) {
  console.log('[Sequence] Root shot index=0 → mode=TEXT_TO_VIDEO (no base video)');
  // Ensure mode is TEXT_TO_VIDEO for root
  if (params.mode === GenerationMode.EXTEND_VIDEO) {
    params = { ...params, mode: GenerationMode.TEXT_TO_VIDEO, inputVideoObject: null };
  }
} else {
  const baseVideo = sequenceVideoData[currentPromptIndex - 1]?.video;
  console.log(`[Sequence] Extension index=${currentPromptIndex} → mode=EXTEND_VIDEO, baseVideoUri=${baseVideo?.uri}`);
  // Force extend mode with proper base video
  params = { 
    ...params, 
    mode: GenerationMode.EXTEND_VIDEO,
    inputVideoObject: baseVideo 
  };
}
```

---

## Guardrail 3 : Empêcher les Clics "Trop Tôt"

### Emplacement : `Studio.tsx` → Passer `isGenerating` à SequenceManager

Ajouter une vérification pour déterminer si le plan précédent est en cours de génération.

### Modifications Requises :

1. **Dans les props de SequenceManager** : Ajouter `isGenerating: boolean` et `generatingIndex: number | null`
2. **Dans l'UI de SequenceManager** : Désactiver le bouton "Use" ou afficher un message si le précédent est en génération
3. **Dans Studio.tsx** : Suivre quel index est en cours de génération

Dans SequenceManager, désactiver le bouton "Use" :
```tsx
const previousDone = index === 0 || videoData[index - 1] !== undefined;
const canUse = previousDone && (!isGenerating || generatingIndex !== index);
```

---

## Guardrail 4 : Logging Clair de la Chaîne

### Emplacement : Plusieurs endroits dans `Studio.tsx`

Logging amélioré pour la chaîne complète :

```typescript
// Quand le plan racine est terminé :
console.log(`[Sequence] Stored root video for index=0: { uri: "${video.uri}" }`);

// Quand une extension est sélectionnée :
console.log(`[Sequence] Preparing extension index=${index} with base video from index=${index-1}: { uri: "${baseVideo.uri}" }`);

// Quand generateVideo est appelé pour une extension :
console.log(`[Sequence] Calling generateVideo for extension index=${index} with mode=EXTEND_VIDEO and baseVideoUri=${baseVideo.uri}`);
```

---

## Fichiers Modifiés

### [MODIFY] Studio.tsx

1. Ajout des guardrails dans `handleGenerate`
2. Amélioration du logging partout
3. Passage de l'état de génération à SequenceManager

### [MODIFY] SequenceManager.tsx

1. Accepter les props `isGenerating` et `generatingIndex`
2. Désactiver le bouton "Use" quand le plan précédent n'est pas prêt
3. Afficher un indicateur visuel pour les extensions bloquées

---

## Sortie Console Attendue

Après implémentation, la console doit afficher :

```
[Sequence] Root shot index=0 → mode=TEXT_TO_VIDEO (no base video)
[Veo] Text-to-video mode (no base video)
...
[Sequence] Stored root video for index=0: { uri: "https://..." }

[Sequence] Preparing extension index=1 with base video from index=0: { uri: "https://..." }
[Sequence] Extension index=1 → mode=EXTEND_VIDEO, baseVideoUri=https://...
[Sequence] Calling generateVideo for extension index=1 with mode=EXTEND_VIDEO and baseVideoUri=https://...
[Veo] Extend mode enabled with base video: https://...
...
[Sequence] Stored extension video for index=1: { uri: "https://..." }
```

---

## Vérification

- Essayer de cliquer "Use" sur Extension 1 avant que le plan racine soit fait → Doit être désactivé
- Essayer de générer Extension 1 sans plan racine → Doit afficher un message d'erreur
- Générer le plan racine, puis Extension 1 → Doit fonctionner avec le logging approprié
- La console doit montrer l'escalier clair : root → ext1 → ext2
