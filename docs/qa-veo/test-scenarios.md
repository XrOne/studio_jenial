# 🧪 Guide de Test Manuel - Génération Vidéo Veo

## 🎯 Objectif

Ce document fournit des **scénarios de test manuel** que vous pouvez exécuter directement sur **jenial.app** en production pour valider que l'intégration Veo fonctionne correctement.

> ⚠️ **IMPORTANT:** Ces tests sont **non destructifs** et **ne modifient aucun code**. Ils vérifient uniquement le comportement de l'UI et des endpoints.

---

## 🔧 Prérequis

Avant de commencer les tests :

- [ ] Accès à l'application : **https://jenial.app** (ou votre URL de prod)
- [ ] Navigateur moderne (Chrome, Firefox, Edge, Safari)
- [ ] Console développeur ouverte (F12) pour voir les logs
- [ ] Une clé API Gemini valide pour certains tests (format `AIzaSy...`)
- [ ] Une clé API **invalide** pour tests d'erreur (ex: `AIza123`)

---

## 📋 Structure des scénarios

Chaque scénario indique :

1. **🎯 Objectif** : Ce qu'on teste
2. **📝 Étapes** : Comment déclencher le test
3. **✅ Résultat attendu** : Ce qui DOIT se passer
4. **🐛 Bug si** : Ce qui indiquerait un problème

---

## ✅ Scénarios de Succès

### Test 1: Génération vidéo avec modèle valide et clé valide

**🎯 Objectif:** Vérifier le flux complet de génération vidéo avec Veo 3.1

**📝 Étapes:**

1. Ouvrir **https://jenial.app**
2. Si demandé, entrer une clé API Gemini valide (commence par `AIzaSy...`)
3. Vérifier que l'icône de clé dans le header est **verte**
4. Dans le champ prompt, entrer : `"A cinematic sunset over mountains, golden hour lighting, slow camera pan"`
5. Sélectionner le modèle : `veo-3.1-004`
6. Aspect Ratio : `16:9`
7. Résolution : `720p`
8. Cliquer sur **"Generate"**

**✅ Résultat attendu:**

- ✅ L'UI passe en mode **Loading** avec un indicateur de progression
- ✅ Console affiche : `[Veo] Starting video generation...`
- ✅ Console affiche : `[Veo] Operation started: operations/...`
- ✅ Toutes les 5 secondes : `[Veo] Polling... (Xs elapsed)`
- ✅ Après 30-120 secondes : Console affiche `[Veo] Video ready: https://...`
- ✅ L'UI affiche le lecteur vidéo avec la vidéo générée
- ✅ Les boutons suivants sont disponibles :
  - "Save to Library"
  - "Retry"
  - "Extend Video"
  - "Back to start"

**🐛 Bug si:**

- ❌ L'UI reste en loading plus de 10 minutes (timeout non géré)
- ❌ Message d'erreur "Model not found" avec un modèle valide
- ❌ La modale de clé API s'ouvre alors que la clé est valide
- ❌ La vidéo ne s'affiche pas après le téléchargement réussi
- ❌ Console affiche des erreurs 404 sur `/api/video/generate`

---

### Test 2: Génération avec modèle Veo 3.1 legacy

**🎯 Objectif:** Vérifier que les anciens modèles Veo fonctionnent toujours

**📝 Étapes:**

1. Même configuration que Test 1
2. Sélectionner le modèle : `veo-3.1-002` (modèle legacy)
3. Prompt : `"A robot walking in a futuristic city"`
4. Cliquer **"Generate"**

**✅ Résultat attendu:**

- ✅ Génération réussie (flux identique au Test 1)
- ✅ Aucune erreur 404

**🐛 Bug si:**

- ❌ Erreur `MODEL_NOT_FOUND` alors que le modèle existe
- ❌ Le backend tente d'utiliser `generateContent` au lieu de `predictLongRunning`

---

## 🔴 Scénarios d'Erreur (Clé API)

### Test 3: Première utilisation sans clé API (mode BYOK)

**🎯 Objectif:** Vérifier que la modale de clé s'affiche au premier lancement

**📝 Étapes:**

1. Ouvrir l'app dans un navigateur **en navigation privée** (pour simuler un nouvel utilisateur)
2. Ou effacer `localStorage` : Console → `localStorage.clear()`
3. Recharger la page

**✅ Résultat attendu:**

- ✅ La modale `ApiKeyDialog` s'affiche **automatiquement**
- ✅ Message : "Aucune clé API configurée. Veuillez entrer votre clé Gemini."
- ✅ Champ de saisie vide
- ✅ Lien vers la documentation Google API

**🐛 Bug si:**

- ❌ Aucune modale ne s'affiche
- ❌ L'app permet de générer une vidéo sans clé
- ❌ Message d'erreur cryptique (ex: "undefined")

---

### Test 4: Clé API invalide (format incorrect)

**🎯 Objectif:** Vérifier la validation frontend de la clé

**📝 Étapes:**

1. Ouvrir la modale de clé API (cliquer l'icône clé dans le header)
2. Entrer une clé invalide : `12345678` (ne commence pas par `AIza`)
3. Cliquer **"Save"**

**✅ Résultat attendu:**

- ✅ Message d'erreur **dans la modale** : "Clé API invalide. Elle doit commencer par 'AIza'."
- ✅ La modale **reste ouverte**
- ✅ Le champ reste rouge / surligné

**🐛 Bug si:**

- ❌ La modale se ferme et accepte la clé invalide
- ❌ Aucun message d'erreur
- ❌ L'app crash

---

### Test 5: Clé API rejetée par Google (403)

**🎯 Objectif:** Vérifier la gestion d'une clé valide en format mais rejetée par l'API

**📝 Étapes:**

1. Entrer une fausse clé (format valide) : `AIzaInvalidKeyTest123456789012345678`
2. Fermer la modale
3. Essayer de générer une vidéo avec un prompt simple

**✅ Résultat attendu:**

- ✅ Génération démarre (loading)
- ✅ Après ~1-2 secondes : Retour à l'état IDLE
- ✅ La modale de clé API **se rouvre automatiquement**
- ✅ Message d'erreur affiché : "Clé API invalide. Vérifiez votre clé et réessayez."
- ✅ Champ pré-rempli avec la clé erronée (surlignée en rouge)

**🐛 Bug si:**

- ❌ La modale ne se rouvre pas
- ❌ Message d'erreur générique "An error occurred"
- ❌ L'UI reste bloquée en mode loading
- ❌ Erreur affichée comme une erreur de modèle (404)

---

## 🔴 Scénarios d'Erreur (Modèle)

### Test 6: Modèle inexistant (404)

**🎯 Objectif:** Vérifier que l'erreur de modèle **NE déclenche PAS** la modale de clé

**📝 Étapes:**

1. S'assurer qu'une clé API **valide** est configurée
2. Dans la console, modifier temporairement le modèle (si possible via UI, sinon tester avec API directe)
3. Ou bien, attendre qu'un modèle soit déprécié et le sélectionner
4. Essayer de générer avec un modèle type : `veo-999-invalid`

**✅ Résultat attendu:**

- ✅ Génération démarre (loading)
- ✅ Après quelques secondes : **Retour à l'état ERROR**
- ✅ Message d'erreur rouge affiché : "Le modèle Veo n'est pas disponible: Model \"veo-999-invalid\" is not available..."
- ✅ **La modale de clé API NE s'ouvre PAS** ⚠️ CRITIQUE
- ✅ Bouton "Try Again" disponible
- ✅ L'icône de clé reste verte (clé toujours valide)

**🐛 Bug si:**

- ❌ La modale de clé API s'ouvre (confusion modèle/clé)
- ❌ Message : "Veuillez entrer votre clé API" (alors que la clé est valide)
- ❌ L'utilisateur est forcé de re-saisir sa clé pour rien
- ❌ Bouton "Try Again" manquant

**🎯 Pourquoi c'est critique:**

> Ce test vérifie le fix principal du projet : distinguer les erreurs de modèle (404) des erreurs de clé (401/403). Avant, l'UI confondait les deux et demandait systématiquement une nouvelle clé.

---

### Test 7: Modèle non accessible avec cette clé

**🎯 Objectif:** Tester le cas où le modèle existe mais la clé n'a pas accès

**📝 Étapes:**

1. Utiliser une clé API qui n'a **pas** accès aux modèles Veo (clé Gemini basique sans early access)
2. Sélectionner `veo-3.1-004`
3. Générer une vidéo

**✅ Résultat attendu:**

- ✅ Backend renvoie 404 ou 403 selon l'implémentation Google
- ✅ Si 404 : Message "Le modèle Veo n'est pas disponible" (pas de modale de clé)
- ✅ Si 403 : Modale de clé s'ouvre avec message de permissions

**🐛 Bug si:**

- ❌ Comportement incohérent entre 403 et 404
- ❌ Crash de l'app

---

## 🔴 Scénarios d'Erreur (Paramètres)

### Test 8: Prompt vide

**🎯 Objectif:** Validation des paramètres avant envoi

**📝 Étapes:**

1. Laisser le champ prompt **complètement vide**
2. Sélectionner un modèle valide
3. Cliquer "Generate"

**✅ Résultat attendu:**

- ✅ **Option A (frontend)** : Bouton "Generate" désactivé si prompt vide
- ✅ **Option B (backend)** : Message d'erreur : "A prompt description is required"
- ✅ État ERROR avec possibilité de retry

**🐛 Bug si:**

- ❌ Requête envoyée au backend avec prompt vide
- ❌ Backend ne valide pas et envoie à Google

---

### Test 9: Caractères spéciaux dans le prompt

**🎯 Objectif:** Vérifier l'encodage et la sécurité

**📝 Étapes:**

1. Entrer un prompt avec caractères spéciaux :  
   `"A robot saying \"Hello World!\" with <special> & symbols"`
2. Générer

**✅ Résultat attendu:**

- ✅ Génération réussie
- ✅ Prompt correctement encodé dans les logs
- ✅ Aucune injection de code

**🐛 Bug si:**

- ❌ Erreur d'encodage
- ❌ Le backend rejette le prompt
- ❌ Vulnérabilité XSS ou injection

---

## ⏱️ Scénarios de Performance

### Test 10: Timeout après 10 minutes

**🎯 Objectif:** Vérifier le comportement en cas de génération trop longue

**📝 Étapes:**

1. Lancer une génération normale
2. **Attendre jusqu'à 10 minutes** (ou simuler en modifiant temporairement le code)

**✅ Résultat attendu:**

- ✅ Après 10 minutes (120 polls * 5s) : Message "Video generation timed out after 10 minutes"
- ✅ État passe à ERROR
- ✅ Possibilité de retry

**🐛 Bug si:**

- ❌ Polling infini sans timeout
- ❌ Crash de l'app
- ❌ UI reste bloquée

---

### Test 11: Annulation pendant la génération

**🎯 Objectif:** Vérifier le bouton "Cancel"

**📝 Étapes:**

1. Lancer une génération
2. Pendant le polling (après 10-15 secondes), cliquer **"Cancel"**

**✅ Résultat attendu:**

- ✅ Génération s'arrête immédiatement
- ✅ Console affiche : `Video generation cancelled by user.`
- ✅ État retourne à **IDLE** (pas ERROR)
- ✅ Le formulaire de prompt reste pré-rempli avec les dernières valeurs
- ✅ Possibilité de relancer immédiatement

**🐛 Bug si:**

- ❌ Le polling continue après le cancel
- ❌ État passe à ERROR au lieu de IDLE
- ❌ Requêtes continuent d'être envoyées au backend

---

## 🔄 Scénarios de Flux Avancés

### Test 12: Génération en séquence (Extension)

**🎯 Objectif:** Vérifier l'extension de vidéo

**📝 Étapes:**

1. Générer une première vidéo avec succès
2. Cliquer **"Extend Video"**
3. Entrer un nouveau prompt : `"Continue with the camera zooming in"`
4. Générer

**✅ Résultat attendu:**

- ✅ Le mode passe à `GenerationMode.EXTEND_VIDEO`
- ✅ Backend reçoit `inputVideoObject` avec la vidéo précédente
- ✅ Nouvelle vidéo générée qui fait suite à la première
- ✅ Console logs montrent le mode extension

**🐛 Bug si:**

- ❌ L'extension génère une vidéo indépendante
- ❌ Erreur "inputVideoObject missing"
- ❌ Le bouton "Extend" est disponible sur un modèle qui ne le supporte pas

---

### Test 13: Retry après erreur

**🎯 Objectif:** Vérifier que le retry utilise les mêmes paramètres

**📝 Étapes:**

1. Provoquer une erreur volontaire (ex: clé invalide)
2. Corriger le problème (re-saisir la clé valide)
3. Cliquer **"Try Again"**

**✅ Résultat attendu:**

- ✅ Le formulaire est pré-rempli avec :
  - Même prompt
  - Même modèle
  - Mêmes paramètres (aspect ratio, résolution)
- ✅ Génération redémarre automatiquement

**🐛 Bug si:**

- ❌ Le formulaire est vide après retry
- ❌ Paramètres différents utilisés
- ❌ Double génération déclenchée

---

## 🔍 Tests de Logs et Console

### Test 14: Logs structurés

**🎯 Objectif:** Vérifier que les logs sont informatifs et **ne contiennent pas de données sensibles**

**📝 Étapes:**

1. Ouvrir Console (F12)
2. Lancer une génération complète (succès)
3. Observer tous les logs

**✅ Résultat attendu:**

- ✅ Logs préfixés avec `[Veo]` pour la génération vidéo
- ✅ Logs montrent les étapes :
  - `[Veo] Starting video generation...`
  - `[Veo] Calling /api/video/generate...`
  - `[Veo] Operation started: operations/...`
  - `[Veo] Polling... (Xs elapsed)`
  - `[Veo] Video ready: https://...`
  - `[Veo] Video downloaded: X bytes`
- ✅ **AUCUN log ne contient la clé API** (ni `AIzaSy...` ni `x-api-key`)

**🐛 Bug si:**

- ❌ Clé API visible dans les logs
- ❌ Logs manquants ou peu informatifs
- ❌ Erreurs non catchées qui apparaissent

---

## 🌐 Tests Multi-environnement

### Test 15: Mode Server-Managed vs BYOK

**🎯 Objectif:** Vérifier les deux modes de clé API

#### Sous-test A: Server-Managed (Production)

**📝 Étapes:**

1. Sur un environnement où `GEMINI_API_KEY` est définie côté serveur
2. Appeler `GET /api/config`

**✅ Résultat attendu:**

```json
{
  "hasServerKey": true,
  "requiresUserKey": false
}
```

- ✅ La modale de clé API ne s'affiche **jamais**
- ✅ L'icône de clé est verte automatiquement
- ✅ Génération fonctionne sans saisir de clé

#### Sous-test B: BYOK (Beta / Dev)

**📝 Étapes:**

1. Sur un environnement où `GEMINI_API_KEY` n'est **PAS** définie
2. Appeler `GET /api/config`

**✅ Résultat attendu:**

```json
{
  "hasServerKey": false,
  "requiresUserKey": true
}
```

- ✅ La modale de clé API s'affiche au premier lancement
- ✅ L'utilisateur doit fournir sa propre clé
- ✅ Header `x-api-key` envoyé dans toutes les requêtes

---

## 📊 Tableau récapitulatif des tests

| # | Scénario | Type | Priorité | Résultat attendu clé |
|---|----------|------|----------|---------------------|
| 1 | Génération réussie | ✅ Succès | 🔴 Haute | Vidéo affichée |
| 2 | Modèle legacy | ✅ Succès | 🟡 Moyenne | Vidéo affichée |
| 3 | Première utilisation | 🔴 Erreur Clé | 🔴 Haute | Modale s'ouvre |
| 4 | Clé format invalide | 🔴 Erreur Clé | 🔴 Haute | Validation frontend |
| 5 | Clé rejetée (403) | 🔴 Erreur Clé | 🔴 Haute | Modale se rouvre |
| 6 | Modèle inexistant | 🔴 Erreur Modèle | 🔴 **CRITIQUE** | **Pas de modale !** |
| 7 | Modèle inaccessible | 🔴 Erreur Modèle | 🟡 Moyenne | Erreur UI |
| 8 | Prompt vide | 🔴 Erreur Param | 🟡 Moyenne | Validation |
| 9 | Caractères spéciaux | 🔴 Erreur Param | 🟢 Basse | Encodage OK |
| 10 | Timeout 10min | ⏱️ Performance | 🟡 Moyenne | Message timeout |
| 11 | Annulation (Cancel) | ⏱️ Performance | 🔴 Haute | Retour IDLE |
| 12 | Extension vidéo | 🔄 Flux avancé | 🟡 Moyenne | Suite générée |
| 13 | Retry après erreur | 🔄 Flux avancé | 🔴 Haute | Params conservés |
| 14 | Logs console | 🔍 Debug | 🟡 Moyenne | Pas de secrets |
| 15 | Server vs BYOK | 🌐 Config | 🟡 Moyenne | Mode détecté |

---

## 🐛 Comment signaler un bug

Si un test échoue, notez :

1. **Numéro du test** (ex: Test 6)
2. **Navigateur et version** (ex: Chrome 120)
3. **Environnement** (Production jenial.app ou local)
4. **Étapes exactes** pour reproduire
5. **Résultat obtenu** vs **Résultat attendu**
6. **Logs de console** (F12 → Console tab)
7. **Erreurs réseau** (F12 → Network tab → filtrer par `api/video`)

---

## ✅ Checklist de validation globale

Avant de déployer une nouvelle version, vérifier :

- [ ] Test 1 (génération basique) passe ✅
- [ ] Test 6 (modèle 404 ne trigger pas modale clé) passe ✅ **CRITIQUE**
- [ ] Test 5 (clé invalide trigger modale) passe ✅
- [ ] Test 11 (cancel fonctionne) passe ✅
- [ ] Test 14 (pas de clé API dans les logs) passe ✅

Si les 5 tests ci-dessus passent → **Déploiement validé** ✅
