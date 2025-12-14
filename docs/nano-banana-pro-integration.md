# Nano Banana Pro - Documentation Technique

> **Version** : 2025-12-13 | **Status** : Prod-ready (architecture) / Mock provider en dev

## Nomenclature Officielle

| Alias Interne | Modèle API Google | Usage |
|---------------|-------------------|-------|
| **Nano Banana** | `gemini-2.5-flash-image` | Preview, Retouch (rapide, 1024px) |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Shot Variants (qualité pro) |

> **Important** : Nano Banana ≠ Imagen. Ce sont les modèles Gemini natifs pour génération/édition d'images.

---

## Architecture

```
Frontend (React)
    │
    └── nanoService.ts
            │
            ├── x-gemini-api-key (header, session-only)
            │
            └── /api/nano/* (Vercel)
                    │
                    ├── BYOK mode: clé du header
                    ├── Server mode: GEMINI_API_KEY env
                    │
                    └── Gemini API
```

---

## Sécurité BYOK

### Règles strictes :

1. **Aucun appel direct à Google depuis le frontend**
2. **Clé BYOK = session uniquement** (`sessionStorage`, pas `localStorage`)
3. **Clé jamais loggée** (ni backend ni frontend)
4. **Transit uniquement vers /api/nano/*** (Vercel)
5. **Backend scrub les headers sensibles** (pas de dump request)

### Frontend :

```typescript
// nanoService.ts - BYOK session-only
const apiKey = window.sessionStorage.getItem('gemini_api_key');
headers['x-gemini-api-key'] = apiKey;
```

### Backend :

```javascript
// api/nano/index.js - Priorité
1. Header 'x-gemini-api-key' (BYOK)
2. Variable GEMINI_API_KEY (server fallback)
// ⚠️ Aucun log de req.headers
```

---

## Configuration

### Vercel Environment Variables

```bash
# Production
NANO_MOCK_MODE=false
GEMINI_API_KEY=your-api-key  # Si pas BYOK

# Development
NANO_MOCK_MODE=true
```

---

## Endpoints

### POST /api/nano/preview

```typescript
// Request
{ textPrompt: string, baseImage?: ImageFile, dogma?: Dogma }

// Response
{ previewImage: ImageFile, previewPrompt: string, requestId: string }
```

### POST /api/nano/retouch

```typescript
// Request
{ baseImage: ImageFile, instruction: string, target: 'root'|'extension'|'character', dogma?: Dogma }

// Response
{ previewImage: ImageFile, previewPrompt: string, requestId: string, target: string }
```

### POST /api/nano/shot-variants

```typescript
// Request
{ baseImage: ImageFile, shotList: string[], dogma?: Dogma }

// Response
{ variants: ShotVariant[], requestId: string }
```

---

## Types

```typescript
interface ImageFile {
  base64: string;
  file?: File;
  mimeType?: string;
}

interface ShotVariant {
  label: string;
  previewImage: ImageFile;
  cameraNotes: string;
  deltaInstruction: string;
}
```

---

## 12 Plans Standard

```typescript
const STANDARD_SHOT_LIST = [
  'Plan d\'ensemble', 'Demi-ensemble', 'Plan moyen', 'Plan genoux',
  'Plan américain', 'Plan taille', 'Plan poitrine', 'Plan épaule',
  'Gros plan', 'Très gros plan', 'Plongée', 'Contre-plongée',
] as const;

// Usage correct
await generateShotVariants({
  baseImage: myImage,
  shotList: [...STANDARD_SHOT_LIST],
  dogma: activeDogma,
});
```

---

## Flows UX

| Flow | Chemin |
|------|--------|
| Stylet → Nano | PromptEditorModal → "Aligner au visuel" → AIEditorModal → "Appliquer" |
| Drift Control | VideoResult → "Recaler avec Nano" → AIEditorModal → "Appliquer" |
| Thumbnails | PromptConception → hover "Nano" → AIEditorModal |
| 12 Vignettes | StoryboardPreviewModal → "Générer 12 Plans" → "Utiliser ce plan" |

---

## Timeline Ordering

```typescript
// Studio.tsx - ligne 1583
sequenceHistory={sortedSequenceHistory}  // ✅ Trié numériquement

// INTERDIT
sequenceHistory={Object.values(sequenceVideoData)}  // ❌ Ordre aléatoire
```

---

## Capacités Utilisées

| Capacité | Nano Banana | Nano Banana Pro |
|----------|-------------|-----------------|
| Génération image | ✅ | ✅ |
| Édition image | ✅ | ✅ |
| Résolution max | 1024px | Élevée |
| Images entrée max | 3 | 5-14 |

> **Note** : Capacités additionnelles (raisonnement, Google Search) documentées par Google mais non exploitées actuellement.

---

## Fichiers Clés

| Fichier | Rôle |
|---------|------|
| `api/nano/index.js` | Backend, providers, handlers |
| `services/nanoService.ts` | Frontend service, BYOK, helpers |
| `components/StoryboardPreviewModal.tsx` | Modal 12 vignettes |
| `components/AIEditorModal.tsx` | Éditeur Nano, onApply |
