# Image-First Workflow - Documentation Technique

> **Date:** 2025-12-14 | **Version:** 1.1 | **Status:** P0+P1 Complete

## Résumé

Transformation du workflow Studio Jenial pour être **visual-first** : l'assistant génère automatiquement des keyframes dès la soumission d'un brief, et l'architecture "Init-Only Proxy" sécurise les uploads BYOK sans limites de taille.

---

## 🚨 P0 BLOQUANTS RÉSOLUS

### 1. Sécurité BYOK & Uploads Larges ("Init-Only Proxy")
**Architecture Modifiée** pour contourner la limite Vercel 4.5MB tout en sécurisant la clé API.

**Flow:**
1. **Frontend** appelle `POST /api/files/upload` (backend) avec métadonnées.
2. **Backend** utilise la clé API (x-goog-api-key) pour initier l'upload via Google Resumable URL.
3. **Frontend** reçoit l'URL signée et envoie les bytes bruts **directement à Google**.

✅ Clé API masquée (reste sur le backend).
✅ Limite de taille Vercel contournée (supporte 2GB+).

### 2. CORS & Build
- **Vercel Headers**: Ajout de `x-gemini-api-key` dans `Access-Control-Allow-Headers`.
- **Build Fixes**: Correction des types (`any[]`) dans `nanoService.ts`.

---

## Fonctionnalités Implémentées

### Phase 1: Auto-Keyframes (Nano Pro)

| Feature | Détail |
|---------|--------|
| **Modèle** | Bascule vers `gemini-3-pro-image-preview` (Qualité Pro) |
| **Génération** | Auto pour Root + Ext1 (`handleSequenceGenerated`) |
| **UI** | Panneau Assistant + Cards Studio via `storyboardByIndex` |
| **Assistant** | Prompt système minimaliste (max 2 questions) |

### Phase 2: Keyframes dans le Studio

| Feature | Fichier | Description |
|---------|---------|-------------|
| `storyboardByIndex` prop | `SequenceManager.tsx` | Données keyframe par segment |
| Affichage keyframe | Cards Prompt Sequence | Priorité: keyframe > video thumbnail > placeholder |
| Badge KEYFRAME | UI | Indique que c'est une preview Nano |
| Bouton Retoucher (Nano) | Hover | Ouvre `AIEditorModal` |
| Bouton Generate Preview | Placeholder | Génère une nouvelle preview via API |

---

## Bugs Corrigés

### Bug 1: Mock provider retournait `null`

**Problème:** `mockProvider.preview` retournait `baseImage || null`. Quand on génère depuis du texte seul (pas d'image de base), il n'y a pas de `baseImage` donc le mock retournait `null`.

**Solution:** Retourner une image placeholder valide (100x100 PNG base64).

```javascript
// Avant (api/nano/index.js)
previewImage: baseImage || null

// Après
const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIA...';
previewImage: baseImage || { base64: placeholderBase64, file: null }
```

---

### Bug 2: "Generate Preview" ne faisait rien

**Problème:** `onThumbnailClick` dans `Studio.tsx` vérifiait `if (baseImage)` avant d'agir. Quand le bouton "Generate Preview" envoyait une string vide, et qu'il n'y avait pas d'image dans `storyboardByIndex`, rien ne se passait.

**Solution:** Quand il n'y a pas d'image existante, appeler `generateNanoPreview()` directement.

```tsx
// Avant
if (baseImage) {
  openNanoEditor(...)
}

// Après
if (existingImage) {
  openNanoEditor(...);
} else {
  // Appel API direct
  const result = await generateNanoPreview({ textPrompt: prompt, dogma });
  setStoryboardByIndex(...);
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│                                                               │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │ Studio.tsx      │    │ SequenceManager.tsx             │  │
│  │ • autoKeyframes │    │ • storyboardByIndex prop        │  │
│  │ • handleSeqGen  │    │ • keyframe display              │  │
│  │ • storyboardBy  │    │ • Generate Preview button       │  │
│  └────────┬────────┘    └─────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────┐                                         │
│  │ nanoService.ts  │ ──────────────────────────────────────► │
│  │ • generatePrev  │      x-gemini-api-key (sessionStorage)  │
│  └────────┬────────┘                                         │
└───────────┼──────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│                    Backend (Vercel/Express)                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /api/nano/preview                                         │  │
│  │ • NANO_MOCK_MODE=true  → mockProvider (placeholder)       │  │
│  │ • NANO_MOCK_MODE=false → realProvider (Gemini API)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Models:                                                        │
│  • Nano Banana: gemini-2.5-flash-image (rapide, 1024px)        │
│  • Nano Banana Pro: gemini-3-pro-image-preview (qualité pro)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fichiers Modifiés

| Fichier | Changements |
|---------|-------------|
| `Studio.tsx` | +autoKeyframesEnabled, +handleSequenceGenerated keyframe logic, +onThumbnailClick fix |
| `SequenceManager.tsx` | +storyboardByIndex prop, +keyframe display, +Generate Preview button |
| `geminiService.ts` | Visual-first system instruction |
| `api/nano/index.js` | Mock provider placeholder fix |
| `docs/nano-banana-pro-integration.md` | +index conventions section |

---

## Conventions d'Index (CRITIQUE)

| segmentIndex | Type | Description |
|--------------|------|-------------|
| `0` | Root | Prompt principal |
| `1..N` | Extension | Extensions 1 à N |
| `null` | Character | Asset personnage (hors séquence) |

```typescript
// CORRECT: dirtyExtensions après modification root
dirtyExtensions = [1, 2, 3]; // Extensions 1-3 dirty (PAS [0, 1, 2])
```

---

## Tests de Validation

| # | Test | Résultat Attendu |
|---|------|------------------|
| 1 | Créer un brief → séquence générée | Keyframes root + ext1 dans panneau droit |
| 2 | Cliquer "Generate Preview" | Image générée et affichée |
| 3 | Cliquer sur keyframe existant | AIEditorModal s'ouvre |
| 4 | Studio cards | Affichent KEYFRAME badge + image |
| 5 | "Start Over" | Tous les états réinitialisés |

---

## Configuration

### Variables d'environnement

```bash
# Production (vraie génération)
NANO_MOCK_MODE=false
GEMINI_API_KEY=your-key  # Si pas BYOK

# Développement (placeholder)
NANO_MOCK_MODE=true
```

### BYOK (Bring Your Own Key)

1. Clé stockée dans `sessionStorage` (pas localStorage)
2. Envoyée via header `x-gemini-api-key`
3. Jamais loggée côté client ni serveur

---

## Commits

1. `Phase 1: Auto-Keyframes in Assistant - generate preview images on sequence creation`
2. `Phase 2: Keyframes in Studio - display preview images in segment cards with Nano retouch`
3. `Phase 1.4: Visual-first assistant - minimal responses (1-2 sentences max)`
4. `docs: Update nano-banana-pro integration with index conventions`
5. `fix: Generate Preview button now calls nano API, mock provider returns placeholder image`
