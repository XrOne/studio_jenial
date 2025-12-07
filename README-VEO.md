# 📹 Documentation Veo - Studio Jenial

Guide complet de l'intégration Veo 3.x pour les développeurs de Studio Jenial.

---

## 🎯 Vue d'ensemble

Studio Jenial utilise l'API Google Veo 3.x pour la génération vidéo IA. Cette documentation explique **comment le système fonctionne**, **les endpoints utilisés**, et **comment gérer les erreurs**.

**Architecture:** Frontend (React) → Backend (Express) → Google Veo API

---

## 📋 Table des Matières

1. [Flux de Génération Vidéo](#flux-de-génération-vidéo)
2. [Endpoints API](#endpoints-api)
3. [Gestion des Clés API](#gestion-des-clés-api)
4. [Gestion des Erreurs](#gestion-des-erreurs)
5. [Modèles Veo Disponibles](#modèles-veo-disponibles)
6. [Paramètres de Génération](#paramètres-de-génération)

---

## 🔄 Flux de génération vidéo

### Vue simplifiée

```
Utilisateur → Studio.tsx → geminiService.ts → server.js → Google Veo API
```

### Étapes détaillées

1. **Utilisateur clique "Generate"** (`Studio.tsx`)
   - Vérifie la clé API
   - Passe à `AppState.LOADING`

2. **Appel `/api/video/generate`** (`geminiService.ts`)
   - Envoie : `model`, `prompt`, `parameters`
   - Reçoit : `{ operationName }`

3. **Polling `/api/video/status`** (toutes les 5s, max 10 min)
   - Vérifie si `done: true`
   - Affiche progression à l'utilisateur

4. **Téléchargement `/api/proxy-video`**
   - Récupère le fichier vidéo généré
   - Crée un `objectUrl` pour le lecteur HTML5

5. **Affichage** (`VideoResult`)
   - Lecteur vidéo
   - Options : Retry, Extend, Save to Library

---

## 🌐 Endpoints API

### 1. POST `/api/video/generate`

Démarre une génération vidéo Veo.

**Request:**
```json
{
  "model": "veo-3.1-generate-preview",
  "prompt": "A sunset over mountains, cinematic",
  "parameters": {
    "aspectRatio": "16:9",
    "resolution": "720p"
  }
}
```

**Response Success (200):**
```json
{
  "operationName": "models/veo-3.1-generate-preview/operations/abc123"
}
```

**Response Error (404 - Modèle non trouvé):**
```json
{
  "error": "MODEL_NOT_FOUND",
  "details": "Model \"veo-3.1-xxx\" is not available..."
}
```

**Fichiers:**
- Frontend: [`geminiService.ts:435`](file:///k:/studio_jenial/services/geminiService.ts#L435)
- Backend: [`server.js:162`](file:///k:/studio_jenial/server.js#L162)

---

### 2. GET `/api/video/status?name={operationName}`

Vérifie l'état d'une génération en cours.

**Request:**
```
GET /api/video/status?name=models/veo-3.1-generate-preview/operations/abc123
```

**Response (en cours):**
```json
{
  "done": false
}
```

**Response (terminé):**
```json
{
  "done": true,
  "videoUri": "https://generativelanguage.googleapis.com/v1beta/files/xyz:download?alt=media"
}
```

**Fichiers:**
- Frontend: [`geminiService.ts:476`](file:///k:/studio_jenial/services/geminiService.ts#L476)
- Backend: [`server.js:246`](file:///k:/studio_jenial/server.js#L246)

---

### 3. GET `/api/proxy-video?uri={videoUri}`

Télécharge la vidéo générée via un proxy sécurisé.

**Sécurité:** Limite les URLs aux domaines Google uniquement (protection SSRF).

**Fichiers:**
- Frontend: [`geminiService.ts:513`](file:///k:/studio_jenial/services/geminiService.ts#L513)
- Backend: [`server.js:298`](file:///k:/studio_jenial/server.js#L298)

---

## 🔑 Gestion des clés API

Studio Jenial supporte **deux modes** :

### Mode 1: Server-Managed

- Variable `GEMINI_API_KEY` définie côté serveur
- Les utilisateurs n'ont **pas besoin** de fournir de clé
- Transparent pour l'utilisateur

**Configuration:**
```bash
# .env ou .env.local
GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXX
```

### Mode 2: BYOK (Bring Your Own Key) - Par défaut

- Chaque utilisateur fournit **sa propre clé**
- Clé stockée dans `localStorage` (navigateur uniquement)
- Jamais envoyée au serveur (sauf via header `x-api-key`)

**Comment l'utilisateur configure sa clé:**
1. À la première utilisation, modale `ApiKeyDialog` s'affiche
2. Utilisateur entre sa clé (commence par `AIza`)
3. Clé sauvegardée dans `localStorage.gemini_api_key`
4. Envoyée dans header `x-api-key` à chaque requête

**Endpoint de vérification:**
```
GET /api/config
→ { hasServerKey: boolean, requiresUserKey: boolean }
```

**Fichiers:**
- Backend: [`server.js:53-69`](file:///k:/studio_jenial/server.js#L53-L69)
- Frontend: [`geminiService.ts:60-87`](file:///k:/studio_jenial/services/geminiService.ts#L60-L87)

---

## 🚨 Gestion des erreurs

### Codes d'erreur définis

| Code | HTTP | Signification | Action UI |
|------|------|---------------|-----------|
| `API_KEY_MISSING` | 401 | Aucune clé configurée | ✅ Ouvre modale clé API |
| `API_KEY_INVALID` | 401 | Clé rejetée par Google | ✅ Ouvre modale clé API |
| `MODEL_NOT_FOUND` | 404 | Modèle inexistant/inaccessible | ❌ Affiche erreur (sans modale) |
| `BAD_REQUEST` | 400 | Paramètres invalides | ❌ Affiche erreur |
| `INTERNAL_ERROR` | 500 | Erreur serveur | ❌ Affiche erreur |

### ⚠️ Distinction Critique : Erreur Modèle vs Erreur Clé

**Problème à éviter:** Ne pas ouvrir la modale de clé API quand c'est le **modèle** qui est indisponible.

**Backend ([`server.js:206-221`](file:///k:/studio_jenial/server.js#L206))**

```javascript
// Si 404 OU message contient "not found"
if (response.status === 404 || errorMessage.includes('not found')) {
  return res.status(404).json({
    error: 'MODEL_NOT_FOUND',
    details: `Model "${model}" is not available...`
  });
}

// Si 401/403 → clé invalide
if (response.status === 401 || response.status === 403) {
  return res.status(401).json({ error: 'API_KEY_INVALID' });
}
```

**Frontend ([`Studio.tsx:588-646`](file:///k:/studio_jenial/Studio.tsx#L588))**

```typescript
if (apiError.status === 404 && apiError.error === 'MODEL_NOT_FOUND') {
  // ❌ NE PAS ouvrir la modale de clé
  showStatusError(`Le modèle Veo n'est pas disponible: ${details}`);
  return;
}

if (apiError.status === 401 && apiError.error === 'API_KEY_INVALID') {
  // ✅ Ouvrir la modale de clé
  setShowApiKeyDialog(true);
  return;
}
```

**Documentation complète:** Voir [`docs/qa-veo/error-handling-analysis.md`](file:///k:/studio_jenial/docs/qa-veo/error-handling-analysis.md)

---

## 🎬 Modèles Veo Disponibles

| Model ID | Description | Statut |
|----------|-------------|--------|
| `veo-3.1-generate-preview` | Veo 3.1 (preview) | ✅ Testé et fonctionnel |
| `veo-3.1-fast` | Version rapide | ⚠️ Vérifier disponibilité selon clé |
| `veo-2` | Ancienne génération| ⚠️ Legacy, préférer 3.1 |

**Note:** La disponibilité des modèles dépend de votre clé API Google. Certaines clés n'ont accès qu'aux modèles preview.

---

## ⚙️ Paramètres de génération

### Aspect Ratio

| Valeur | Format |
|--------|--------|
| `16:9` | Horizontal (paysage) |
| `9:16` | Vertical (portrait) |
| `1:1` | Carré |

### Résolution

| Valeur | Dimensions approximatives |
|--------|---------------------------|
| `720p` | 1280x720 (recommandé) |
| `1080p` | 1920x1080 (plus lent) |

### Modes de Génération

| Mode | Description | Paramètres requis |
|------|-------------|-------------------|
| `TEXT_TO_VIDEO` | Texte → Vidéo | `prompt` |
| `FRAMES_TO_VIDEO` | Image → Vidéo animée | `prompt`, `startFrame` |
| `EXTEND_VIDEO` | Extension de vidéo | `inputVideoObject`, `prompt` |
| `REFERENCES_TO_VIDEO` | Images de référence → Vidéo | `prompt`, `referenceImages` |

**Fichier:** [`types.ts:17-22`](file:///k:/studio_jenial/types.ts#L17)

---

## ⏱️ Temps de génération

- **Minimum:** ~20-30 secondes (vidéos simples)
- **Moyen:** 1-2 minutes
- **Maximum:** 10 minutes (timeout)

Le polling s'effectue toutes les **5 secondes** avec un maximum de **120 tentatives** (10 minutes).

---

## 📁 Fichiers Essentiels

### Frontend

| Fichier | Rôle |
|---------|------|
| [`Studio.tsx`](file:///k:/studio_jenial/Studio.tsx) | Logique UI principale, gestion des états |
| [`services/geminiService.ts`](file:///k:/studio_jenial/services/geminiService.ts) | Communication avec l'API backend |
| [`components/ApiKeyDialog.tsx`](file:///k:/studio_jenial/components/ApiKeyDialog.tsx) | Modale de configuration clé API |
| [`components/VideoResult.tsx`](file:///k:/studio_jenial/components/VideoResult.tsx) | Affichage résultat vidéo |

### Backend

| Fichier | Rôle |
|---------|------|
| [`server.js`](file:///k:/studio_jenial/server.js) | Serveur Express, proxy vers Google Veo |

---

## 🔗 Documentation Complémentaire

- **[Flux Veo (diagrammes détaillés)](./docs/qa-veo/flux-veo-overview.md)** - Vue technique du flux complet
- **[Cartographie des appels API](./docs/rapport-cartographie-veo-frontend.md)** - Analyse ligne par ligne
- **[Gestion des erreurs (technique)](./docs/qa-veo/error-handling-analysis.md)** - Tous les cas d'erreur
- **[Scénarios de test](./docs/qa-veo/test-scenarios.md)** - Comment tester manuellement
- **[Rapport QA Backend](./docs/test-report-veo-valid.md)** - Test avec vraie clé API
- **[Vérification endpoints](./docs/endpoint-verification-report.md)** - Validation des endpoints actuels

---

## 🛠️ Débogage

### Le serveur ne démarre pas

```bash
# Vérifier les dépendances
npm install

# Lancer le serveur seul
npm run server

# Vérifier les logs
# Chercher des erreurs liées à GEMINI_API_KEY ou port 3001
```

### La modale de clé s'ouvre en boucle

**Cause:** Erreur 404 (modèle) confondue avec erreur 401 (clé).

**Solution:** Vérifier les logs backend pour le code d'erreur exact. Si `MODEL_NOT_FOUND`, le problème n'est PAS la clé.

### Timeout après 10 minutes

**Causes possibles:**
- Prompt trop complexe
- Surcharge de l'API Google
- Modèle lent

**Solution:** Réessayer avec un prompt plus simple ou un modèle `fast`.

---

## ✅ Checklist de Validation

Avant de déployer des modifications :

- [ ] `/api/config` retourne `{ hasServerKey: true/false }`
- [ ] `/api/health` retourne status 200
- [ ] Génération vidéo fonctionne (clé valide)
- [ ] Erreur 404 (modèle) n'ouvre PAS la modale clé
- [ ] Erreur 401 (clé) OUVRE la modale clé
- [ ] Cancel pendant génération fonctionne
- [ ] Logs backend ne contiennent PAS de clés API

---

## 📞 Contact

Pour questions ou bugs, voir le chef de projet ou le lead dev de Studio Jenial.

**Version:** 1.0 - Décembre 2025
