# Correction du State Management Prompt/Dogma

## Problèmes Résolus

### Problème 1: Assistant "stylet" incohérent
**Cause**: Le `PromptEditorModal` utilisait `activeDogma` (global) au lieu du dogma lié à la séquence.

**Solution**: Ajout de `sequenceBoundDogma` qui capture le dogma actif au moment de la création de la séquence.

### Problème 2: Mauvaise gestion de l'état global
**Cause**: `dogma-library` et `active-dogma-id` stockés globalement sans scoping par projet.

**Solution**: 
- Ajout de `dogmaId` dans `PromptSequence` pour traçabilité
- `handleStartNewProject` nettoie maintenant `sequenceBoundDogma`
- Suppression de l'auto-injection de Déclics

### Problème 3: Logique cassée entre prompt racine et extensions
**Cause**: Aucune invalidation automatique des extensions lors de la modification du prompt racine.

**Solution**:
- Ajout de `status` et `dirtyExtensions` dans `PromptSequence`
- Modification du root → toutes les extensions marquées "dirty"
- UI met en évidence les extensions à régénérer (orange)

---

## Nouveaux Types

```typescript
export interface PromptSequence {
  id: string;
  dogmaId: string | null;
  mainPrompt: string;
  extensionPrompts: string[];
  status: PromptSequenceStatus;
  dirtyExtensions: number[];
  createdAt: string;
  rootModifiedAt?: string;
}

export enum PromptSequenceStatus {
  CLEAN = 'clean',
  ROOT_MODIFIED = 'root_modified',
  EXTENSIONS_DIRTY = 'extensions_dirty',
  GENERATING = 'generating',
}
```

---

## Règles Métier Implémentées

### Règle 1: Hiérarchie stricte ✓
- `PromptSequence.dogmaId` lie le dogma à la séquence
- Extensions dépendent du root via `dirtyExtensions`

### Règle 2: Propagation obligatoire ✓
- Modification root → `status = ROOT_MODIFIED`
- Toutes extensions marquées dirty
- Message utilisateur affiché

### Règle 3: Scoping strict ✓
- `sequenceBoundDogma` utilisé partout (pas `activeDogma`)
- Contexte explicite dans chaque handler

---

## Templates Dogma (Optionnels)

Les dogmas Déclics et Satin sont maintenant dans `data/dogmaTemplates.ts` pour import optionnel.

```typescript
import { DOGMA_TEMPLATES, createDogmaFromTemplate } from './data/dogmaTemplates';

// Pour ajouter Déclics:
const declics = createDogmaFromTemplate('declics-lumiere-ombre');
```

---

## Intégration Nano Banana Pro

Cliquer sur une miniature dans le SequenceManager déclenche maintenant le callback `onThumbnailClick` pour l'édition d'image Nano Banana Pro.
