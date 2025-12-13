# 🔐 AUDIT BYOK - Studio Jenial (Gemini API)

**Date**: 2025-12-13  
**Auditeur**: Antigravity Security Review  
**Scope**: Circulation des clés API, stockage, endpoints backend, orchestration, logging

---

## 📊 RÉSUMÉ EXÉCUTIF

| Domaine | Statut | Niveau de Risque |
|---------|--------|------------------|
| Circulation des clés API | ⚠️ À CORRIGER | **CRITIQUE** |
| Stockage Supabase | ✅ OK | Faible |
| Endpoints Backend | ⚠️ À AMÉLIORER | Moyen |
| Orchestration/Boucles | ✅ OK | Faible |
| Logs & Observabilité | ✅ OK | Faible |

---

## 1. CIRCULATION DES CLÉS API

### 1.1 Architecture Actuelle

```
┌─────────────┐      x-api-key header      ┌─────────────┐      x-goog-api-key      ┌─────────────┐
│   Frontend  │ ──────────────────────────▶│   Backend   │ ──────────────────────▶ │  Google API │
│             │                             │  (Vercel)   │                          │   (Gemini)  │
└─────────────┘                             └─────────────┘                          └─────────────┘
      │                                            ▲
      │                                            │
      │      ⚠️ APPEL DIRECT (CRITIQUE)            │
      └────────────────────────────────────────────┘
```

### 1.2 Findings

#### ✅ OK - Appels via Backend

| Fichier | Ligne | Flux |
|---------|-------|------|
| `geminiService.ts` | 194-224 | `callVeoBackend()` → `/api/*` → Backend |
| `geminiService.ts` | 227-267 | `apiCall()` → `/api/*` → Backend |

**Diagnostic**: Les appels principaux (génération vidéo, content) passent correctement par le backend.

---

#### 🔴 CRITIQUE - Appel Direct Google API depuis Frontend

| Fichier | Ligne | Problème |
|---------|-------|----------|
| `geminiService.ts` | 294-370 | `uploadToGoogleFiles()` appelle directement `https://generativelanguage.googleapis.com/upload/v1beta/files` |

**Code problématique**:
```typescript
// geminiService.ts:310-318
const initResponse = await fetch(GOOGLE_FILES_API, {
  method: 'POST',
  headers: {
    // ...
    'x-goog-api-key': apiKey,  // ⚠️ CLÉ EN CLAIR DANS LE NAVIGATEUR
  },
  // ...
});
```

**Risques**:
1. La clé API est visible dans DevTools > Network
2. N'importe quel script malveillant sur la page peut intercepter la clé
3. Violation du principe BYOK (la clé ne devrait transiter que vers le backend)

**Correction requise**: Proxifier l'upload via le backend (voir section Corrections).

---

#### ✅ OK - Stockage localStorage

| Clé | Fichier | Diagnostic |
|-----|---------|------------|
| `gemini_api_key` | `geminiService.ts:143-161` | Acceptable pour BYOK |

**Note**: Le stockage en localStorage est un compromis acceptable pour BYOK. La clé reste sur le navigateur de l'utilisateur et n'est jamais envoyée à nos serveurs pour stockage.

---

#### ✅ OK - Aucun Logging de Clés

**Vérifié**:
- `server.js:86`: `const errorCode = error.code || 'UNKNOWN_ERROR';` - Pas de log de clé
- `server.js:106`: `console.error('API Error:', errorCode);` - Seulement le code erreur
- Aucun `console.log(apiKey)` ou équivalent trouvé

---

## 2. STOCKAGE SUPABASE

### 2.1 Configuration Client

| Fichier | Diagnostic |
|---------|------------|
| `supabaseClient.ts` | Utilise `VITE_SUPABASE_ANON_KEY` (clé anonyme publique) |

**Statut**: ✅ OK - La clé Supabase utilisée est la clé anonyme (publique par design).

### 2.2 RLS (Row Level Security)

**Non vérifiable via code** - RLS doit être configuré dans le dashboard Supabase.

> **⚠️ RECOMMANDATION**: Vérifier dans Supabase Dashboard que:
> - RLS est activé sur toutes les tables
> - Aucune politique ne permet `SELECT *` sans filtre `user_id`

### 2.3 Stockage des Clés Gemini

**Aucune table de stockage de clés Gemini côté serveur trouvée** ✅

Les clés sont uniquement dans `localStorage` du navigateur de l'utilisateur.

---

## 3. ENDPOINTS BACKEND

### 3.1 Inventaire des Routes Gemini

| Route | Fichier | Ligne | Fonction |
|-------|---------|-------|----------|
| `POST /api/generate-content` | `server.js` | 121 | Génération de contenu |
| `POST /api/video/generate` | `server.js` | 209 | Démarrage génération vidéo |
| `GET /api/video/status` | `server.js` | 314 | Polling statut |
| `GET /api/proxy-video` | `server.js` | 388 | Proxy téléchargement |

### 3.2 Analyse de Sécurité

#### ⚠️ MANQUANT - Rate Limiting

**Statut**: Aucun rate limiting détecté.

**Risque**: Un utilisateur malveillant pourrait bombarder le backend avec des requêtes, impactant la stabilité pour tous.

**Recommandation**:
```javascript
// Ajouter dans server.js
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 requêtes par minute par IP
  message: { error: 'RATE_LIMIT_EXCEEDED' }
});

app.use('/api/', apiLimiter);
```

---

#### ⚠️ MANQUANT - Limite de Concurrence

**Statut**: Pas de limite sur le nombre de générations simultanées.

**Risque**: Un utilisateur pourrait lancer 100 générations en parallèle.

---

#### ⚠️ MANQUANT - Timeout Explicite sur Polling

**Code actuel** (`server.js:314-382`):
```javascript
// Pas de timeout explicite côté serveur
// Le frontend a un maxPolls de 120 (10 min) mais le serveur n'a pas de protection
```

**Recommandation**: Ajouter un timeout serveur de 5 minutes pour le polling.

---

#### ✅ OK - Retries Contrôlés

Le polling fait 1 requête toutes les 5 secondes, contrôlé par le frontend. Pas de retry agressif.

---

#### ⚠️ MANQUANT - Idempotency

**Statut**: Pas de protection contre les double-submit.

**Risque**: L'utilisateur clique 2x rapidement sur "Generate" → 2 générations facturées.

**Recommandation**: Implémenter un `request_id` ou verrouillage UI.

---

## 4. ORCHESTRATION / AGENTS

### 4.1 Boucles Potentielles

**Vérifié**:
- Pas de pattern `agent → agent` détecté
- Le polling a un `maxPolls` de 120 (limite claire)
- Pas de retry automatique infini

**Statut**: ✅ OK

### 4.2 Request ID

**Manquant** - Les requêtes n'ont pas d'identifiant unique pour traçabilité.

**Recommandation**: Ajouter `X-Request-ID` header.

---

## 5. LOGS & OBSERVABILITÉ

### 5.1 Analyse des Logs Backend

| Pattern | Trouvé | Risque |
|---------|--------|--------|
| `console.log(apiKey)` | ❌ Non | - |
| `console.log(req.headers['x-api-key'])` | ❌ Non | - |
| Log de prompts complets | ❌ Non | - |

**Statut**: ✅ OK - Pas de fuite de données sensibles dans les logs.

### 5.2 Logs Actuels

```javascript
// Exemples de logs actuels (OK)
console.log('[Veo] Starting video generation with model:', model);
console.log('[Veo] Operation started:', operationName);
```

**Recommandation** (optionnel): Structurer les logs pour monitoring:
```javascript
console.log(JSON.stringify({
  type: 'video_generation',
  model,
  status: 'started',
  timestamp: new Date().toISOString(),
  // PAS de apiKey ou prompt
}));
```

---

## 🔧 CORRECTIONS REQUISES

### Priorité 1 (CRITIQUE)

#### Proxifier l'upload Google Files via Backend

**Créer** `api/files/upload.js`:

```javascript
// api/files/upload.js (nouveau fichier)
const GOOGLE_FILES_API = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = getApiKey(req);
    const { displayName, mimeType, fileSize } = req.body;

    // Step 1: Initialize upload
    const initResponse = await fetch(GOOGLE_FILES_API, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // Clé côté serveur uniquement
      },
      body: JSON.stringify({ file: { displayName } }),
    });

    // Return upload URL to client (sans la clé)
    const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
    return res.json({ uploadUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

**Modifier** `geminiService.ts`:
```typescript
export const uploadToGoogleFiles = async (file: File | Blob, displayName?: string) => {
  // Step 1: Get upload URL from our backend (clé gérée côté serveur)
  const initRes = await apiCall('/files/upload', {
    displayName,
    mimeType: file.type,
    fileSize: file.size,
  });

  // Step 2: Upload directly to Google (pas de clé nécessaire, URL pré-signée)
  const uploadResponse = await fetch(initRes.uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file,
  });
  
  // ...rest
};
```

---

### Priorité 2 (MOYEN)

#### Ajouter Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
// server.js - ajouter en haut
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'RATE_LIMIT_EXCEEDED' }
});

// Appliquer avant les routes
app.use('/api/', apiLimiter);
```

---

### Priorité 3 (OPTIONNEL)

- Ajouter `X-Request-ID` pour traçabilité
- Structurer les logs en JSON pour monitoring
- Ajouter verrou UI contre double-submit

---

## ✅ CHECKLIST FINALE BYOK SÉCURISÉ

| Critère | Statut | Action |
|---------|--------|--------|
| Clé jamais stockée en clair côté serveur | ✅ | - |
| Clé jamais loggée | ✅ | - |
| Tous les appels Gemini via backend | ⚠️ | Proxifier `uploadToGoogleFiles` |
| Rate limiting API | ⚠️ | Ajouter `express-rate-limit` |
| Timeout explicite | ⚠️ | Ajouter timeout serveur |
| Idempotency | ⚠️ | Ajouter request ID |
| RLS Supabase | ? | Vérifier dashboard |
| Pas de boucle infinie | ✅ | - |

---

**Conclusion**: L'architecture BYOK est globalement saine avec **un point critique** (appel direct Google Files API) à corriger en priorité. Les autres points sont des améliorations de robustesse.
