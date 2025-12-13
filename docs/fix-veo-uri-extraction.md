# Fix Veo URI Extraction

**Date**: 2025-12-13  
**Statut**: ✅ Implémenté  
**Priorité**: Haute

---

## Problème

Erreur: `"No video URI in completed operation response"`

Le backend `server.js` ne trouvait pas l'URI vidéo dans la réponse Veo car le chemin d'extraction était trop rigide :

```javascript
// Ancien code - un seul chemin
const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
```

---

## Solution Implémentée

Ajout de **fallbacks multiples** pour supporter différents formats de réponse Veo :

**Fichier modifié**: `server.js` (lignes 361-390)

```javascript
// Extract video URI - try multiple paths for different Veo versions
let videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

// Fallback paths for different API response formats
if (!videoUri) {
  videoUri = data.response?.video?.uri;
}
if (!videoUri) {
  videoUri = data.response?.generatedSamples?.[0]?.video?.uri;
}
if (!videoUri) {
  videoUri = data.result?.video?.uri;
}
if (!videoUri) {
  videoUri = data.video?.uri;
}

if (!videoUri) {
  console.error('[Veo] No video URI found. Full response:', JSON.stringify(data, null, 2));
  return res.status(500).json({
    done: true,
    error: 'No video URI in completed operation response',
    debug: { responseKeys: Object.keys(data || {}), hasResponse: !!data.response }
  });
}
```

---

## Chemins Supportés

| Chemin | Format Veo |
|--------|------------|
| `data.response.generateVideoResponse.generatedSamples[0].video.uri` | VEO 3.0 |
| `data.response.video.uri` | Format simplifié |
| `data.response.generatedSamples[0].video.uri` | Sans wrapper |
| `data.result.video.uri` | Format legacy |
| `data.video.uri` | Format minimal |

---

## Debug Amélioré

En cas d'échec, la réponse inclut maintenant :
- `debug.responseKeys` : Liste des clés dans la réponse
- `debug.hasResponse` : Boolean indiquant si `data.response` existe

Cela permet de diagnostiquer rapidement quel format Veo retourne.

---

## Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| `server.js` | 361-390 | Fallback URI extraction + debug info |
