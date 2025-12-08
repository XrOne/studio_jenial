# Rapport de Tâche : Guardrails pour Extensions de Séquence

## Objectif
Ajouter des garde-fous solides pour que l'UX de Prompt Sequence se comporte comme un plateau de tournage : on ne filme JAMAIS une extension si le plan précédent n'est pas vraiment dans la boîte.

## Guardrails Complétés

### Guardrail 1 : Bloquer Extension Sans Vidéo de Base ✅
**Emplacement :** `Studio.tsx` → `handleGenerate`

Lors de la génération d'une extension (index > 0) :
- Vérifie `sequenceVideoData[index - 1]?.video?.uri`
- Si manquant, bloque la génération avec un message d'erreur
- Log : `[Sequence] Cannot generate extension index=X: missing base video for index=X-1`

### Guardrail 2 : Le Mode Doit Correspondre à la Situation ✅
**Emplacement :** `Studio.tsx` → `handleGenerate`

- Plan racine (index 0) : Force le mode TEXT_TO_VIDEO, efface inputVideoObject
- Extension (index > 0) : Force le mode EXTEND_VIDEO avec le bon baseVideo
- Log clair : `[Sequence] Root shot index=0 → mode=TEXT_TO_VIDEO (no base video)`
- Log clair : `[Sequence] Extension index=X → mode=EXTEND_VIDEO, baseVideoUri=...`

### Guardrail 3 : Empêcher les Clics "Trop Tôt" ✅
**Emplacements :** `SequenceManager.tsx`, `Studio.tsx`

- SequenceManager : Bouton "Use" désactivé si le plan précédent n'est pas fait
- handleSelectPromptFromSequence : Log un avertissement et affiche un message d'erreur
- handleContinueSequence : Vérifie video.uri spécifiquement, bloque si manquant

### Guardrail 4 : Logging Clair de la Chaîne ✅
**Emplacement :** Partout dans `Studio.tsx`

La sortie console montre l'escalier :
```
[Sequence] Root shot index=0 → mode=TEXT_TO_VIDEO (no base video)
[Sequence] Stored root video for index=0: { uri: "..." }
[Sequence] Preparing extension index=1 with base video from index=0: { uri: "..." }
[Sequence] Extension index=1 → mode=EXTEND_VIDEO, baseVideoUri=...
[Sequence] Calling generateVideo for extension index=1 with mode=EXTEND_VIDEO and baseVideoUri=...
[Sequence] Stored extension video for index=1: { uri: "..." }
```

## Fichiers Modifiés
- [x] `Studio.tsx` - Tous les guardrails dans handleGenerate, logging amélioré partout
- [x] `SequenceManager.tsx` - Bouton Use désactivé quand le précédent n'est pas prêt

## Contraintes Respectées
- ✅ N'a PAS modifié VideoResult.tsx
- ✅ N'a PAS modifié MediaSource ou l'extraction de keyframes
- ✅ N'a PAS touché aux storage providers
- ✅ A seulement modifié le code sequence/Studio/SequenceManager

## Résultat

Il est maintenant **IMPOSSIBLE** de :
- ❌ Démarrer une extension si le plan précédent n'a pas de vidéo
- ❌ Générer une extension en mode text-to-video
- ❌ "Prétendre" étendre sans une vraie vidéo de base

La continuité visuelle est **techniquement forcée** au niveau du code.
