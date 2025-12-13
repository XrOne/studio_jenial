# Fix BYOK Security - Proxy Upload Google Files

**Date**: 2025-12-13  
**Statut**: ✅ Implémenté  
**Priorité**: CRITIQUE

---

## Problème

La fonction `uploadToGoogleFiles()` dans `geminiService.ts` appelait **directement** l'API Google depuis le navigateur avec la clé API en clair dans le header `x-goog-api-key`.

**Risque**: La clé était visible dans DevTools > Network, exposée à tout script malveillant.

---

## Solution Implémentée

### 1. Nouveau Endpoint Backend

**Fichier créé**: `api/files/upload.js`

```javascript
// Initialise l'upload côté serveur, retourne une URL pré-signée
const GOOGLE_FILES_API = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

export default async function handler(req, res) {
  const apiKey = getApiKey(req); // Clé gérée serveur
  const { displayName, mimeType, fileSize } = req.body;

  const initResponse = await fetch(GOOGLE_FILES_API, {
    headers: {
      'x-goog-api-key': apiKey, // Clé UNIQUEMENT côté serveur
      // ...
    },
  });

  const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
  return res.json({ uploadUrl }); // URL pré-signée, pas de clé
}
```

### 2. Modification Frontend

**Fichier modifié**: `services/geminiService.ts`

```typescript
export const uploadToGoogleFiles = async (file, displayName) => {
  // Step 1: Obtenir URL via notre backend (clé serveur)
  const { uploadUrl } = await fetch('/api/files/upload', {
    headers: { 'x-api-key': key }, // Si BYOK mode
    body: JSON.stringify({ displayName, mimeType, fileSize }),
  });

  // Step 2: Upload direct vers Google (pas de clé nécessaire)
  const uploadResponse = await fetch(uploadUrl, {
    body: file, // URL pré-signée
  });
};
```

---

## Flux Avant/Après

### ❌ Avant (Vulnérable)
```
Frontend → Google API (avec x-goog-api-key visible dans DevTools)
```

### ✅ Après (Sécurisé)
```
Frontend → /api/files/upload → Google API (clé serveur)
         ← uploadUrl (pré-signée)
Frontend → Google (uploadUrl, sans clé)
```

---

## Fichiers Modifiés

| Fichier | Action | Lignes |
|---------|--------|--------|
| `api/files/upload.js` | **CRÉÉ** | 90 lignes |
| `services/geminiService.ts` | Modifié | 287-367 |

---

## Test

1. Ouvrir DevTools > Network
2. Lancer un upload d'image volumineuse
3. Vérifier qu'aucune requête ne contient `x-goog-api-key`
4. La requête `/api/files/upload` doit contenir `x-api-key` (header BYOK)
5. La requête vers Google doit utiliser une URL signée sans clé
