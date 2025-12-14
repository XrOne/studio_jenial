# Nano Banana Pro — Documentation Technique (Studio Jenial)

**Dernière mise à jour : 13/12/2025**  
Objectif : **voir → retoucher → appliquer → (re)générer**. Nano Banana Pro sert à verrouiller la mise en scène (axe, cadrage, mouvement) **avant Veo**, et à **corriger la dérive** après extensions.

---

## 1) État d’avancement

| Phase | Statut | Notes |
|---|---:|---|
| Fondations (types, endpoints, helpers) | ✅ | `/api/nano/*` mock + helpers `deriveTarget`, `deriveDirtyExtensions`, `getEffectiveDogma` |
| Core patterns (nanoEditorContext, openNanoEditor) | ✅ | 1 seul contrôleur d’ouverture Nano |
| Stylet (PromptEditorModal → Nano → Apply) | ✅ | Root + extensions, cascade dirtyExtensions OK |
| Timeline ordering (SequenceFlow stable) | ✅ | `sortedSequenceHistory` tri numérique |
| Drift control (VideoResult → Recaler avec Nano) | ✅ | dernier keyframe → Nano → Apply sur extension |
| Retouche thumbnails (SequenceFlow hover actions + badges) | ⏳ | prochain chantier |
| 12 vignettes (Shot Variants / couverture de plans) | ⏳ | via StoryboardPreviewModal |
| Timeline I/O/X (EDL légère) | ⏳ | après storyboard fiable |
| Characters (couverture + retouches + DNA image) | ⏳ | dépend des 12 vignettes + patterns Nano |

---

## 2) Principes non négociables

1. **Pas de nouvel écran** : on étend l’existant (`PromptConception`, `SequenceManager`, `PromptEditorModal`, `AIEditorModal`, `StoryboardPreviewModal`, `CharacterManager`).
2. **AIEditorModal = moteur Nano Banana** : AngleKit + quick axis + image edit + “Appliquer Prompt”.
3. **BYOK / sécurité** : aucune clé ni appel Gemini/Nano depuis le front.
4. **Dogma scoping strict** : en séquence, toute action IA/Nano utilise :
   - `effectiveDogma = sequenceBoundDogma ?? activeDogma`
5. **Convention d’indices** :
   - `segmentIndex = 0` → root
   - `segmentIndex = 1..N` → extensions
   - `extensionPrompts[segmentIndex - 1]`
   - `dirtyExtensions = [1..N]` (jamais 0)
6. **Sobriété UX** : 2–3 clics max, réponses courtes, actions visuelles.

---

## 3) Rôle de Nano Banana Pro dans le workflow “cinéma”

### 3.1 Verrouiller une intention (avant Veo)
- Créer une **référence** (image) qui valide : composition / axe / ambiance / lisibilité
- Décliner en **couverture de plans** (12 vignettes) pour décider du découpage
- Transformer une correction visuelle en **prompt exact** (appliqué au bon segment)

### 3.2 Corriger une dérive (après Veo)
- Prendre un **frame** (keyframe / dernier frame)
- Demander à Nano “revenir à l’axe voulu”
- Réécrire le prompt d’extension correspondant
- Relancer l’extension

### 3.3 Personnages : la “DNA image” (cohérence)
Nano Banana Pro est utile pour construire une image de référence « ADN » :
- **side-by-side** (face + plein pied) dans une même image
- ou **contact sheet** (4 angles) pour préserver identité + tenue + proportions  
Cette image devient la base pour : portraits, variantes, shots, et cohérence multi-scènes.

### 3.4 “Contact sheets” (ce que la démo met en avant)
Pour obtenir une cohérence vraiment exploitable en série (même persos, même tenue) :
- générer une **image “side-by-side”** (visage serré + plein pied, même personnage) comme base ADN
- ou générer une **planche multi-angle** (4 vues dans la même image) pour “bloquer” identité + proportions + outfit
- réutiliser cette image comme **baseImage** dans Nano (retouches, variants 12 plans, portraits, etc.)

👉 Intégration Studio Jenial : ajouter (dans Characters puis global) une action “Créer DNA image” qui produit la planche, la stocke, et la propose comme base par défaut.

---

## 4) Architecture (haut niveau)

```mermaid
graph TD
  subgraph Frontend
    STUDIO[Studio.tsx] -->|nanoEditorContext| AIE[AIEditorModal]
    STUDIO -->|openNanoEditor| PEM[PromptEditorModal]
    STUDIO -->|openNanoEditor| VR[VideoResult]
    STUDIO -->|sequenceHistory sorted| PC[PromptConception / SequenceFlow]
    STUDIO -->|storyboardByIndex| PC
    STUDIO --> SBPM[StoryboardPreviewModal]
  end

  subgraph Backend (Vercel / API)
    NANO[/api/nano/* (mock puis provider réel)/]
  end

  AIE -->|preview image + prompt| STUDIO
  Frontend -->|fetch| NANO
```

---

## 5) Types clés

### 5.1 NanoApplyPayload
```ts
export type NanoApplyPayload = {
  target: 'root' | 'extension' | 'character';
  segmentIndex: number | null;        // null=character, 0=root, 1..N=extension
  previewPrompt: string;
  previewImage: ImageFile;
  cameraNotes?: string;
  movementNotes?: string;
};
```

### 5.2 NanoEditorContext
```ts
export type NanoEditorContext = {
  segmentIndex: number | null;
  target: 'root' | 'extension' | 'character';
  dogma: Dogma;
  baseImage?: ImageFile;
  initialPrompt?: string;
};
```

### 5.3 StoryboardPreview
```ts
export type StoryboardPreview = {
  id: string;
  owner: 'root' | 'extension' | 'character';
  segmentIndex?: number;
  characterId?: string;
  baseImage?: ImageFile;
  previewImage: ImageFile;
  previewPrompt: string;
  cameraNotes?: string;
  movementNotes?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 5.4 ShotVariant (12 vignettes)
```ts
export type ShotVariant = {
  label: string;
  previewImage: ImageFile;
  cameraNotes: string;
  deltaInstruction: string;
};
```

---

## 6) Backend : endpoints Nano (mock aujourd’hui)

- `POST /api/nano/preview`
- `POST /api/nano/retouch`
- `POST /api/nano/shot-variants`

> Le backend est en mock. Un provider réel pourra remplacer la logique interne sans toucher l’UI.

---

## 7) Patterns implémentés (core)

### 7.1 Ouverture Nano centralisée (Studio.tsx)
- `nanoEditorContext` (state)
- `openNanoEditor({ segmentIndex, baseImage, initialPrompt })`
- `closeNanoEditor()`

### 7.2 Application Nano centralisée
`handleNanoApply(payload)` applique strictement :
- **Root** : update `mainPrompt` + `dirtyExtensions=[1..N]` + `storyboardByIndex[0]`
- **Extension** : update `extensionPrompts[segmentIndex-1]` + retrait dirty + `storyboardByIndex[segmentIndex]`
- **Character** : update asset perso (sans dirtyExtensions)

### 7.3 Drift control (VideoResult)
- bouton “Recaler avec Nano” (visible seulement si `activePromptIndex >= 1`)
- baseImage = dernier `keyframe`
- `openNanoEditor({ segmentIndex: activePromptIndex, baseImage, initialPrompt })`

---

## 8) Prochain chantier #1 — Retouche thumbnails (SequenceFlow)

### Objectif
Sur chaque thumbnail du SequenceFlow :
- bouton hover : **“Retoucher (Nano)”**
- badge : `Preview OK / Missing / Dirty`
- clic : ouvre Nano avec `segmentIndex` + `baseImage` thumbnail + `initialPrompt`

### Règles de badge
- OK : `storyboardByIndex[segmentIndex]` existe
- Missing : sinon
- Dirty : `segmentIndex >= 1` et `dirtyExtensions.includes(segmentIndex)`

### Acceptance
- Root retouch depuis thumbnail → dirtyExtensions=[1..N]
- Ext2 retouch depuis thumbnail → ext2 sort du dirty, storyboardByIndex[2] OK

---

## 9) Prochain chantier #2 — 12 vignettes (couverture de plans) via StoryboardPreviewModal

### Objectif
Depuis une image de référence (priorité : `storyboardByIndex[segmentIndex].previewImage`) :
- appeler `/api/nano/shot-variants`
- afficher 12 vignettes (grille)
- action “Utiliser ce plan” :
  - applique directement via `handleNanoApply` (target dérivé du segment)
  - et met à jour `storyboardByIndex[segmentIndex]`

### Liste standard (par défaut)
1. Plan d’ensemble
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

### Contrat Nano (deltaInstruction)
- “Ne change pas la scène ni les personnages. Ajuste uniquement cadrage/hauteur/focale/angle.”

---

## 10) Timeline I/O/X (EDL légère) — plus tard

À implémenter **après** thumbnails + 12 vignettes.

MVP attendu :
- viewer + marks IN/OUT
- keybinds : `I`, `O`, `X`, `G` (clear)
- timeline = liste de segments (EDL simple)

---

## 11) Characters — comment Nano Banana Pro aide vraiment

### 11.1 Construire une “DNA image” (recommandé)
- générer une image **face + plein pied** côte-à-côte
- ou 4 angles dans une planche (contact sheet)
- stocker comme référence principale du personnage

### 11.2 Exploiter la DNA image
- portraits / poses / plans serrés sans perdre l’identité
- cohérence tenue + proportions
- meilleure stabilité pour décliner sur plusieurs scènes

---

## 12) Tests d’acceptance (à maintenir)

| Test | Résultat attendu |
|---|---|
| Stylet root → Nano → Apply | Root MAJ, dirty=[1..N], storyboard[0] MAJ |
| Stylet ext2 → Nano → Apply | ext2 MAJ, ext2 retiré du dirty, storyboard[2] MAJ |
| Drift control ext2 | AIEditorModal ouvre avec keyframe, ext2 MAJ |
| Timeline ordre | root→ext1→ext2… stable |
| Thumbnails retouch | hover button + badges OK/Missing/Dirty + apply OK |
| 12 vignettes | grille 12, “Utiliser” applique prompt + preview au segment |
