# 📚 QA Analysis - Studio Jenial Veo Integration (Synthèse)

## 🎯 Mission accomplie

Cette analyse QA a été réalisée en **mode lecture seule** sans modifier aucun fichier du projet Studio Jenial.

> ✅ **Aucun code n'a été modifié**  
> ✅ **Aucune commande git n'a été exécutée**  
> ✅ **Documentation produite uniquement**

---

## 📦 Documents produits

### 1️⃣ [Flux Front ↔ Veo (Vue d'ensemble)](file:///C:/Users/User/.gemini/antigravity/brain/30f1c192-e049-4de9-b76b-1b0045a4dd54/flux-veo-overview.md)

**Contenu:**
- Flux complet utilisateur → backend → Google Veo
- Diagramme de séquence Mermaid
- Description de chaque endpoint (`/api/video/generate`, `/api/video/status`, `/api/proxy-video`)
- Structure des données (`GenerateVideoParams`, réponses API)
- Modes de génération (TEXT_TO_VIDEO, EXTEND_VIDEO, etc.)
- Gestion des clés API (Server-Managed vs BYOK)

**Utilité:**  
Permet de comprendre comment une vidéo est générée du clic utilisateur jusqu'à l'affichage, sans toucher au code.

---

### 2️⃣ [Gestion des Erreurs API](file:///C:/Users/User/.gemini/antigravity/brain/30f1c192-e049-4de9-b76b-1b0045a4dd54/error-handling-analysis.md)

**Contenu:**
- Tous les codes d'erreur définis (`API_KEY_MISSING`, `API_KEY_INVALID`, `MODEL_NOT_FOUND`, etc.)
- Comment le backend détecte et génère chaque erreur
- Comment le frontend affiche chaque erreur (modale, message UI, etc.)
- **Point crucial:** Distinction entre erreur de modèle (404) et erreur de clé (401)
- Tableau récapitulatif : quelle erreur ouvre la modale de clé API, laquelle ne l'ouvre pas

**Utilité:**  
Comprendre sur le papier comment chaque erreur est censée être gérée, sans exécuter de code.

---

### 3️⃣ [Scénarios de Test Manuel (QA)](file:///C:/Users/User/.gemini/antigravity/brain/30f1c192-e049-4de9-b76b-1b0045a4dd54/test-scenarios.md)

**Contenu:**
- **15 scénarios de test** détaillés pour tester sur jenial.app (prod)
- Tests de succès (génération vidéo, modèles legacy)
- Tests d'erreur de clé API (manquante, invalide, rejetée)
- **Test critique #6:** Vérifier que MODEL_NOT_FOUND n'ouvre PAS la modale de clé
- Tests de paramètres (prompt vide, caractères spéciaux)
- Tests de performance (timeout, cancel)
- Tests de flux avancés (extension vidéo, retry)
- Checklist de validation avant déploiement

**Utilité:**  
Liste de tests manuels que l'humain peut exécuter directement en production pour valider le comportement sans modifier le code.

---

### 4️⃣ [Task.md - Suivi du travail](file:///C:/Users/User/.gemini/antigravity/brain/30f1c192-e049-4de9-b76b-1b0045a4dd54/task.md)

**Contenu:**
- Checklist des tâches d'analyse
- Statut de complétion

---

## 🔑 Constatations clés

### Architecture actuelle

**Frontend:**
- Composant principal : [`Studio.tsx`](file:///K:/studio_jenial/Studio.tsx)
- Service API : [`services/geminiService.ts`](file:///K:/studio_jenial/services/geminiService.ts)
- Fonction de génération : `generateVideo(params, signal)`

**Backend:**
- Serveur Express : [`server.js`](file:///K:/studio_jenial/server.js)
- Endpoints Veo :
  - `POST /api/video/generate` → Lance la génération (predictLongRunning)
  - `GET /api/video/status?name=...` → Polling de l'opération
  - `GET /api/proxy-video?uri=...` → Téléchargement sécurisé

**API Google Veo:**
- URL de base : `https://generativelanguage.googleapis.com/v1beta`
- Format requis : `{ instances: [{ prompt }], parameters: {...} }`
- Méthode : `:predictLongRunning` (asynchrone avec polling)

---

### Gestion des erreurs (état actuel)

**✅ Ce qui fonctionne bien:**

1. **Distinction modèle/clé** (lignes 206-221 de `server.js`) :
   - 404 → `MODEL_NOT_FOUND` (n'ouvre pas la modale)
   - 401/403 → `API_KEY_INVALID` (ouvre la modale)

2. **Codes d'erreur structurés** :
   ```typescript
   interface ApiError {
     status: number;
     error: string;
     data?: any;
   }
   ```

3. **Double gestion frontend** (Studio.tsx lignes 588-646) :
   - Erreurs structurées modernes (recommandé)
   - Fallback legacy pour compatibilité

4. **Sécurité des logs** :
   - Les clés API ne sont jamais loggées
   - Seuls les codes d'erreur apparaissent

**🔍 Points d'attention:**

1. **Fallback legacy (lignes 615-646)** peut créer de la confusion si les deux systèmes se contredisent
2. **Timeout hardcodé** à 10 minutes (120 polls * 5s) sans configuration
3. **Mode BYOK** nécessite que l'utilisateur comprenne où obtenir une clé Gemini

---

## 🎨 Flux de données typique (résumé)

```
Utilisateur clique "Generate"
  ↓
Studio.tsx → handleGenerate()
  ↓
geminiService.ts → generateVideo()
  ↓
POST /api/video/generate (backend)
  ↓
Google Veo API :predictLongRunning
  ↓
Retour: { operationName: "operations/123" }
  ↓
Polling (GET /api/video/status) toutes les 5s
  ↓
done: true, videoUri: "https://..."
  ↓
GET /api/proxy-video?uri=... (téléchargement)
  ↓
Blob → URL.createObjectURL()
  ↓
Affichage dans <video> (VideoResult)
```

---

## 🧪 Tests recommandés (prioritaires)

Avant tout déploiement, exécuter **au minimum** ces 5 tests :

| # | Test | Criticité | Objectif |
|---|------|-----------|----------|
| 1 | Génération réussie | 🔴 Haute | Flux complet fonctionne |
| 5 | Clé invalide (403) | 🔴 Haute | Modale se rouvre |
| **6** | **Modèle 404** | 🔴 **CRITIQUE** | **Modale NE s'ouvre PAS** |
| 11 | Cancel pendant polling | 🔴 Haute | Annulation propre |
| 14 | Logs console | 🔴 Haute | Pas de secrets |

> ⚠️ **Test #6 est le plus important** car il valide le fix principal : ne pas confondre erreur de modèle avec erreur de clé.

---

## 📊 Endpoints documentés

| Endpoint | Méthode | Rôle | Fichier backend |
|----------|---------|------|----------------|
| `/api/config` | GET | Détection mode (Server-Managed / BYOK) | [server.js:109-115](file:///K:/studio_jenial/server.js#L109-L115) |
| `/api/video/generate` | POST | Démarre génération Veo | [server.js:162-242](file:///K:/studio_jenial/server.js#L162-L242) |
| `/api/video/status` | GET | Poll opération en cours | [server.js:246-313](file:///K:/studio_jenial/server.js#L246-L313) |
| `/api/proxy-video` | GET | Télécharge vidéo (proxy sécurisé) | [server.js:317-383](file:///K:/studio_jenial/server.js#L317-L383) |
| `/api/generate-content` | POST | Chat / Text generation (non-Veo) | [server.js:143-157](file:///K:/studio_jenial/server.js#L143-L157) |

---

## 🚀 Prochaines étapes suggérées

**Pour l'utilisateur (vous):**

1. ✅ Lire les 3 documents produits
2. 🧪 Exécuter les tests prioritaires (#1, #5, #6, #11, #14) sur jenial.app
3. 📝 Noter les bugs éventuels dans un tracker
4. 🔄 Partager les résultats avec l'équipe

**Pour de futures améliorations (optionnel):**

1. Ajouter des tests automatisés (Jest/Playwright) basés sur les scénarios manuels
2. Créer un dashboard de monitoring des erreurs API
3. Améliorer le messaging utilisateur (messages d'erreur en français)
4. Créer une page de debug (`/debug/veo-logs`) pour visualiser les opérations en cours

---

## 📁 Structure des artefacts

Tous les documents sont dans :

```
C:\Users\User\.gemini\antigravity\brain\30f1c192-e049-4de9-b76b-1b0045a4dd54\
├── task.md                      # Checklist de la mission
├── flux-veo-overview.md         # Documentation flux complet
├── error-handling-analysis.md   # Documentation erreurs
├── test-scenarios.md            # 15 scénarios de test manuel
└── README.md                    # Ce fichier (synthèse)
```

---

## 🎓 Glossaire

| Terme | Définition |
|-------|------------|
| **Veo** | Modèle de génération vidéo de Google (ex: veo-3.1-004) |
| **BYOK** | Bring Your Own Key - mode où l'utilisateur fournit sa clé API |
| **Server-Managed** | Mode où la clé API est configurée côté serveur (env var) |
| **predictLongRunning** | Méthode API Google pour opérations asynchrones longues |
| **Polling** | Interrogation répétée du statut d'une opération (toutes les 5s) |
| **SSRF** | Server-Side Request Forgery - vulnérabilité où le serveur peut être forcé à faire des requêtes malveillantes |

---

## ✅ Validation de la mission

- [x] Code analysé sans modification
- [x] Flux front → backend documenté
- [x] Gestion d'erreurs expliquée sur le papier
- [x] Scénarios de test manuel proposés (15 tests)
- [x] Documentation réutilisable pour l'équipe
- [x] Aucune commande git exécutée
- [x] Aucun fichier du projet modifié

**Mission QA accomplie ✅**

---

## 📞 Contact / Questions

Si vous avez des questions sur cette analyse :

1. Consultez d'abord les 3 documents détaillés
2. Exécutez les tests manuels pour valider en pratique
3. Notez les écarts entre comportement observé et documentation

**Rappel important:** Cette analyse est basée sur la lecture du code au **2025-12-07**. Si le code a évolué depuis, certains détails peuvent différer.
