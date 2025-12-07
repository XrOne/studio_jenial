# 🚨 Gestion des Erreurs API - Veo Integration

## 🎯 Vue d'ensemble

Ce document décrit **comment les erreurs sont gérées** dans Studio Jenial lors de la génération vidéo Veo, depuis leur détection backend jusqu'à leur affichage utilisateur.

---

## 📋 Codes d'erreur définis

### Backend → Frontend

| Code Erreur | Status HTTP | Déclencheur | Où généré |
|-------------|-------------|-------------|-----------|
| `API_KEY_MISSING` | 401 | Aucune clé API fournie | [`server.js:65-68`](file:///K:/studio_jenial/server.js#L65-L68) |
| `API_KEY_INVALID` | 401 | Clé API invalide ou rejetée par Google | [`server.js:87-89`](file:///K:/studio_jenial/server.js#L87-L89) |
| `MODEL_NOT_FOUND` | 404 | Modèle Veo non accessible | [`server.js:210-213`](file:///K:/studio_jenial/server.js#L210-L213) |
| `BAD_REQUEST` | 400 | Paramètres invalides | [`server.js:91-96`](file:///K:/studio_jenial/server.js#L91-L96) |
| `INTERNAL_ERROR` | 500 | Erreur serveur inconnue | [`server.js:99-103`](file:///K:/studio_jenial/server.js#L99-L103) |

---

## 🔍 Détection des erreurs (Backend)

### 1️⃣ Vérification de la clé API

**Fichier:** [`server.js`](file:///K:/studio_jenial/server.js#L53-L69)  
**Fonction:** `getApiKey(req)`

```javascript
const getApiKey = (req) => {
  // Priority 1: Server-managed key
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 20) {
    return process.env.GEMINI_API_KEY.trim();
  }

  // Priority 2: User-provided key (BYOK mode)
  const userKey = req.headers['x-api-key'];
  if (userKey && typeof userKey === 'string' && userKey.trim().length >= 20) {
    return userKey.trim();
  }

  // No key found
  const error = new Error('API_KEY_MISSING');
  error.code = 'API_KEY_MISSING';
  error.statusCode = 401;
  throw error;
};
```

**Résultat:**
- ✅ Si clé serveur présente → utilise la clé serveur
- ✅ Si clé utilisateur présente (header `x-api-key`) → utilise la clé user
- ❌ Si aucune clé → lance `API_KEY_MISSING`

---

### 2️⃣ Distinction Modèle vs Clé (endpoint `/api/video/generate`)

**Fichier:** [`server.js`](file:///K:/studio_jenial/server.js#L206-L221)  
**Lignes critiques:** 206-221

```javascript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  const errorMessage = errorData.error?.message || response.statusText;

  // 🔴 MODEL ERROR (404)
  if (response.status === 404 ||
    errorMessage.toLowerCase().includes('not found') ||
    errorMessage.toLowerCase().includes('does not exist')) {
    return res.status(404).json({
      error: 'MODEL_NOT_FOUND',
      details: `Model "${model}" is not available or not accessible with your API key.`
    });
  }

  // 🔴 API KEY ERROR (401/403)
  if (response.status === 401 || response.status === 403) {
    return res.status(401).json({
      error: 'API_KEY_INVALID',
      details: errorMessage
    });
  }
}
```

**Logique de distinction:**
- **404 OU message contenant "not found"** → `MODEL_NOT_FOUND`
- **401 ou 403** → `API_KEY_INVALID`

> ⚠️ **IMPORTANT:** Cette distinction empêche la confusion entre "modèle non disponible" et "clé invalide".

---

## 🎨 Affichage des erreurs (Frontend)

### Endpoint: `Studio.tsx` → `handleGenerate`

**Fichier:** [`Studio.tsx`](file:///K:/studio_jenial/Studio.tsx#L576-L646)  
**Lignes critiques:** 588-646

#### Capture des erreurs structurées (nouveau format)

```typescript
const apiError = error as ApiError;
if (apiError.status && apiError.error) {
  // Structured error from backend
  
  if (apiError.status === 401 && apiError.error === 'API_KEY_MISSING') {
    setApiKeyError('Aucune clé API configurée. Veuillez entrer votre clé Gemini.');
    setShowApiKeyDialog(true);
    setAppState(AppState.IDLE);
    return;
  }
  
  if (apiError.status === 401 && apiError.error === 'API_KEY_INVALID') {
    setApiKeyError('Clé API invalide. Vérifiez votre clé et réessayez.');
    setShowApiKeyDialog(true);
    setAppState(AppState.IDLE);
    return;
  }
  
  if (apiError.status === 404 && apiError.error === 'MODEL_NOT_FOUND') {
    // ✅ MODEL ERROR: Show in UI, DON'T open API key dialog
    showStatusError(`Le modèle Veo n'est pas disponible: ${apiError.data?.details || 'Vérifiez que votre clé API dispose de l\\'accès aux modèles Veo 3.1.'}`);
    return;
  }
}
```

**Comportements selon l'erreur:**

| Erreur | UI Résultat | Modale Clé API |
|--------|-------------|----------------|
| `API_KEY_MISSING` | Retour à IDLE | ✅ Ouvre |
| `API_KEY_INVALID` | Retour à IDLE | ✅ Ouvre |
| `MODEL_NOT_FOUND` | Affiche erreur dans `AppState.ERROR` | ❌ N'ouvre PAS |
| `BAD_REQUEST` | Affiche erreur dans `AppState.ERROR` | ❌ N'ouvre PAS |

---

### Interface `ApiError`

**Fichier:** [`geminiService.ts`](file:///K:/studio_jenial/services/geminiService.ts#L135-L139)

```typescript
export interface ApiError {
  status: number;
  error: string;
  data?: any;
}
```

**Fonction `callVeoBackend`** qui génère ces erreurs :

```typescript
if (!res.ok) {
  const apiError: ApiError = {
    status: res.status,
    error: data.error || 'UNKNOWN_ERROR',
    data
  };
  throw apiError;
}
```

---

## 🎭 Scénarios d'erreur détaillés

### Scénario 1: Clé API manquante (première utilisation)

**Déclencheur:** Utilisateur n'a jamais configuré de clé API (mode BYOK)

#### Backend (`server.js`)

```javascript
// getApiKey(req) est appelé
throw new Error('API_KEY_MISSING');
```

**Réponse HTTP:**
```json
Status: 401
{ "error": "API_KEY_MISSING" }
```

#### Frontend (`Studio.tsx`)

```typescript
if (apiError.status === 401 && apiError.error === 'API_KEY_MISSING') {
  setApiKeyError('Aucune clé API configurée. Veuillez entrer votre clé Gemini.');
  setShowApiKeyDialog(true); // ✅ Ouvre la modale
  setAppState(AppState.IDLE);
}
```

**Résultat UI:**
- ✅ La modale `ApiKeyDialog` s'affiche
- Message: "Aucune clé API configurée. Veuillez entrer votre clé Gemini."
- Champ de saisie pour entrer `AIza...`
- L'utilisateur entre sa clé → sauvegardée dans `localStorage`

---

### Scénario 2: Clé API invalide

**Déclencheur:** Clé fournie mais rejetée par Google (401/403)

#### Backend (`server.js`)

L'appel à Google Veo renvoie une erreur 401 :

```javascript
if (response.status === 401 || response.status === 403) {
  return res.status(401).json({
    error: 'API_KEY_INVALID',
    details: errorMessage
  });
}
```

**Réponse HTTP:**
```json
Status: 401
{
  "error": "API_KEY_INVALID",
  "details": "API key not valid. Please pass a valid API key."
}
```

#### Frontend (`Studio.tsx`)

```typescript
if (apiError.status === 401 && apiError.error === 'API_KEY_INVALID') {
  setApiKeyError('Clé API invalide. Vérifiez votre clé et réessayez.');
  setShowApiKeyDialog(true); // ✅ Ouvre la modale
  setAppState(AppState.IDLE);
}
```

**Résultat UI:**
- ✅ La modale `ApiKeyDialog` s'affiche
- Message d'erreur: "Clé API invalide. Vérifiez votre clé et réessayez."
- Champ de saisie pré-rempli avec la clé actuelle (surlignée en rouge)
- L'utilisateur peut corriger sa clé

---

### Scénario 3: Modèle non trouvé (404)

**Déclencheur:** Le modèle demandé n'existe pas ou n'est pas accessible avec cette clé

#### Backend (`server.js`)

```javascript
if (response.status === 404 ||
  errorMessage.toLowerCase().includes('not found') ||
  errorMessage.toLowerCase().includes('does not exist')) {
  return res.status(404).json({
    error: 'MODEL_NOT_FOUND',
    details: `Model "${model}" is not available or not accessible with your API key.`
  });
}
```

**Réponse HTTP:**
```json
Status: 404
{
  "error": "MODEL_NOT_FOUND",
  "details": "Model \"veo-3.1-999\" is not available or not accessible with your API key."
}
```

#### Frontend (`Studio.tsx`)

```typescript
if (apiError.status === 404 && apiError.error === 'MODEL_NOT_FOUND') {
  // ❌ DON'T open API key dialog - this is a model issue, not a key issue
  showStatusError(`Le modèle Veo n'est pas disponible: ${apiError.data?.details || '...'}`);
  return;
}
```

**Résultat UI:**
- ❌ La modale de clé API **NE s'ouvre PAS**
- ✅ L'état passe à `AppState.ERROR`
- Message rouge affiché : "Le modèle Veo n'est pas disponible: Model \"veo-3.1-999\" is not available..."
- Bouton "Try Again" disponible
- **L'utilisateur ne doit PAS re-saisir sa clé** (ce n'est pas un problème de clé)

---

### Scénario 4: Paramètres invalides (400)

**Déclencheur:** Prompt vide, modèle manquant, etc.

#### Backend (`server.js`)

```javascript
if (!model) {
  return res.status(400).json({ error: 'Model is required' });
}

if (!prompt || !prompt.trim()) {
  return res.status(400).json({ error: 'Prompt is required' });
}
```

**Réponse HTTP:**
```json
Status: 400
{ "error": "Prompt is required" }
```

#### Frontend (`Studio.tsx`)

```typescript
if (apiError.status === 400) {
  showStatusError(`Requête invalide: ${apiError.data?.details || 'Vérifiez vos paramètres.'}`);
  return;
}
```

**Résultat UI:**
- ✅ Message d'erreur affiché dans l'UI
- ❌ Modale de clé API n'est pas ouverte

---

## 🧪 Gestion des erreurs legacy (fallback)

**Fichier:** [`Studio.tsx`](file:///K:/studio_jenial/Studio.tsx#L615-L646)

Si l'erreur n'est pas structurée (ancien format), le frontend analyse le message texte :

```typescript
const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';

if (errorMessage.includes('MODEL_NOT_FOUND') ||
  (errorMessage.toLowerCase().includes('model') && errorMessage.toLowerCase().includes('not found'))) {
  userFriendlyMessage = 'Le modèle Veo sélectionné n\'est pas disponible...';
  // ❌ DON'T open key dialog
}

if (errorMessage.includes('API_KEY_INVALID') ||
  errorMessage.includes('API key not valid') ||
  errorMessage.includes('API_KEY_MISSING')) {
  userFriendlyMessage = 'Votre clé API est invalide, manquante ou...';
  shouldOpenDialog = true; // ✅ Open key dialog
}
```

> ⚠️ Ce fallback garantit la compatibilité avec d'anciennes versions du backend.

---

## 🎯 Composant `ApiKeyDialog`

**Fichier:** `components/ApiKeyDialog.tsx`

**Props:**
```typescript
{
  onContinue: () => void;
  hasCustomKey: boolean;
  providerToken?: string;
  errorMessage?: string;  // Message d'erreur à afficher
}
```

**Affichage selon `errorMessage`:**

```tsx
{errorMessage && (
  <div className="bg-red-900/30 border border-red-500 text-red-300 p-3 rounded-lg">
    <span className="font-semibold">Erreur:</span> {errorMessage}
  </div>
)}
```

**Validation de la clé:**

```typescript
const handleSave = () => {
  if (apiKey.trim().startsWith('AIza') && apiKey.trim().length > 20) {
    setLocalApiKey(apiKey.trim());
    onContinue();
  } else {
    setError('Clé API invalide. Elle doit commencer par "AIza".');
  }
};
```

---

## 📊 Tableau récapitulatif des flux d'erreur

| Erreur | Backend Status | Frontend Action | Modale Clé | État App |
|--------|---------------|-----------------|-----------|----------|
| **API_KEY_MISSING** | 401 | Ouvre modale avec message | ✅ Oui | IDLE |
| **API_KEY_INVALID** | 401 | Ouvre modale avec message | ✅ Oui | IDLE |
| **MODEL_NOT_FOUND** | 404 | Affiche erreur UI | ❌ Non | ERROR |
| **BAD_REQUEST** | 400 | Affiche erreur UI | ❌ Non | ERROR |
| **INTERNAL_ERROR** | 500 | Affiche erreur générique | ❌ Non | ERROR |
| **Timeout (10min)** | - | Affiche "Timeout" | ❌ Non | ERROR |
| **Abort (Cancel)** | - | Retour à IDLE | ❌ Non | IDLE |

---

## 🔐 Sécurité des logs

**Fichier:** [`server.js`](file:///K:/studio_jenial/server.js#L76-L104)

Le backend **ne log JAMAIS** les valeurs de clé API :

```javascript
const handleError = (res, error) => {
  // Don't log API keys - only log error code/message
  const errorCode = error.code || 'UNKNOWN_ERROR';
  console.error('API Error:', errorCode); // ✅ Pas de clé loggée
  
  // ...
}
```

---

## 🧪 Points de validation

Pour **vérifier que la gestion d'erreur fonctionne** (voir aussi `test-scenarios.md`):

1. ✅ Clé manquante → Modale s'ouvre avec "Aucune clé API configurée"
2. ✅ Clé invalide (ex: `AIza123`) → Modale s'ouvre avec "Clé API invalide"
3. ✅ Modèle invalide (ex: `veo-999`) → Message d'erreur UI, **SANS** modale
4. ✅ Prompt vide → Message d'erreur UI
5. ✅ Cancel pendant polling → Retour à IDLE proprement

---

## 🔄 Cycle de retry

Après une erreur, l'utilisateur peut :

- **Bouton "Try Again"** → Réutilise les mêmes paramètres (si erreur de modèle/prompt)
- **Corriger sa clé** → Ferme la modale, relance automatiquement (si erreur de clé)
- **Bouton "Back to start"** → Reset complet

**Code:**
```typescript
const handleRetryLastPrompt = useCallback(() => {
  if (lastConfig) {
    if (!confirmUnsavedVideo()) return;
    setInitialFormValues(lastConfig);
    setCurrentStage(AppStage.PROMPTING);
  }
}, [lastConfig, confirmUnsavedVideo]);
```
