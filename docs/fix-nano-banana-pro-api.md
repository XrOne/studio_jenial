# Fix Nano Banana Pro API - Vercel 500 Errors

**Date:** 2025-12-15

## Problème

Les endpoints `/api/nano/*` retournaient des erreurs 500 sur Vercel, identique au problème rencontré avec `/api/config`.

## Cause racine

### Bug 1: Variable non définie
```javascript
// Ligne 493 de api/nano/index.js
_models: {
    nanoBanana: NANO_BANANA_MODEL,  // ❌ Variable n'existe pas!
    // ...
}
```

### Bug 2: Pattern de wrapper incorrect pour Vercel

Les wrappers exportaient des **références de méthodes** au lieu de **fonctions handler**:

```javascript
// ❌ Incorrect - Vercel ne reconnaît pas cette signature
export default nanoHandlers.preview;

// ✅ Correct - Fonction handler standard
export default async function handler(req, res) {
    return handlePreview(req, res);
}
```

## Correction appliquée

| Fichier | Changement |
|---------|------------|
| `api/nano/index.js` | `NANO_BANANA_MODEL` → `NANO_FAST_MODEL` |
| `api/nano/preview.js` | Réécrit comme handler Vercel |
| `api/nano/retouch.js` | Réécrit comme handler Vercel |
| `api/nano/shot-variants.js` | Réécrit comme handler Vercel |

## Pattern à respecter pour futurs endpoints

Tout endpoint Vercel doit exporter une fonction handler:

```javascript
// api/my-endpoint.js
export default async function handler(req, res) {
    // CORS, validation, logique...
    res.status(200).json({ ok: true });
}
```

**Ne jamais faire:**
```javascript
import handlers from './handlers.js';
export default handlers.myMethod;  // ❌ Ne fonctionne pas sur Vercel!
```

## Voir aussi

- [nano-banana-pro-integration.md](./nano-banana-pro-integration.md) - Documentation complète Nano Banana Pro
- [vercel.json](../vercel.json) - Configuration Vercel
