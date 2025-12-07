# 🚨 Guide des Erreurs - Studio Jenial

Guide simplifié pour comprendre et résoudre les erreurs lors de la génération vidéo.

---

## 🔑 Erreurs de Clé API

### "Aucune clé API configurée"

**Ce que ça veut dire:** Vous n'avez pas encore configuré votre clé Google Gemini.

**Solution:**
1. Une modale devrait s'ouvrir automatiquement
2. Obtenez votre clé sur [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Collez la clé (commence par `AIza...`)
4. Cliquez "Continuer"

**Votre clé est sauvegardée localement** dans votre navigateur uniquement.

---

### "Clé API invalide"

**Ce que ça veut dire:** La clé que vous avez entrée ne fonctionne pas.

**Raisons possibles:**
- Clé mal copiée (espaces, caractères manquants)
- Clé révoquée ou expirée
- Clé sans accès Veo

**Solution:**
1. Vérifiez que la clé est complète (commence par `AIza`)
2. Générez une nouvelle clé sur [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Entrez la nouvelle clé dans la modale

---

## 🎬 Erreurs de Modèle

### "Le modèle Veo n'est pas disponible"

**Ce que ça veut dire:** Le modèle vidéo que vous essayez d'utiliser n'est pas accessible.

**⚠️ IMPORTANT:** Ce n'est **PAS** une erreur de clé API.

**Raisons possibles:**
- Le modèle n'existe pas (ex: `veo-3.1-xxx`)
- Votre clé n'a pas accès aux modèles Veo 3.1
- Le modèle est en preview limitée

**Solutions:**
1. **Vérifiez votre accès Veo:**
   - Allez sur [Google AI Studio](https://aistudio.google.com)
   - Créez un nouveau prompt vidéo
   - Notez quels modèles Veo sont disponibles
2. **Utilisez un modèle disponible:**
   - Essayez `veo-3.1-generate-preview` (le plus commun)
   - Ou demandez au déployeur quel modèle utiliser
3. **Demandez l'accès:**
   - Si aucun modèle Veo n'est visible, demandez accès à Google

---

## ⏱️ Erreurs de Timeout

### "Video generation timed out after 10 minutes"

**Ce que ça veut dire:** La génération a pris trop de temps.

**Raisons possibles:**
- Prompt très complexe
- Serveurs Google surchargés
- Modèle lent

**Solutions:**
1. **Réessayez** (parfois ça passe la 2e fois)
2. **Simplifiez le prompt**
3. **Utilisez un modèle "fast"** si disponible
4. **Attendez quelques minutes** et réessayez

---

## ❌ Erreurs Générales

### "Requête invalide"

**Ce que ça veut dire:** Il manque quelque chose dans votre demande.

**Solutions:**
- Vérifiez que le prompt n'est pas vide
- Vérifiez qu'un modèle est sélectionné
- Si vous uploadez une image, vérifiez qu'elle est chargée

---

### "Failed to proxy video" / "Failed to download video"

**Ce que ça veut dire:** Le serveur n'a pas pu télécharger votre vidéo depuis Google.

**Solutions:**
1. **Réessayez** - parfois c'est un problème temporaire
2. **Vérifiez votre connexion internet**
3. Si le problème persiste, contactez le support

---

## 🔄 Annulation

### Vous avez cliqué "Cancel" pendant la génération

**C'est normal.** Vous pouvez :
- Cliquer sur "Try Again" pour relancer
- Ou modifier votre prompt et régénérer

**Note:** Les générations annulées ne consomment généralement pas de crédit API.

---

## 🛠️ Débogage Avancé

### Comment savoir si c'est un problème de clé ou de modèle ?

**Problème de clé API (modale s'ouvre):**
- Message contient "clé API" ou "API key"
- La modale de saisie de clé s'affiche

**Problème de modèle (pas de modale):**
- Message contient "modèle" ou "model"
- Message d'erreur rouge affiché dans l'interface
- **Pas besoin de re-saisir votre clé !**

---

### Logs dans la console navigateur

Si vous êtes technique, ouvrez la console (F12) et cherchez :

```
[Veo] Starting video generation...
[Veo] Calling /api/video/generate...
[Veo] Operation started: models/veo-3.1.../operations/...
[Veo] Polling... (5s elapsed)
```

Les erreurs apparaîtront en rouge avec des détails.

---

## 📞 Besoin d'Aide ?

Si vous ne trouvez pas la solution :

1. **Notez le message d'erreur exact**
2. **Capturez une capture d'écran** si possible
3. **Contactez le support** avec ces informations

**Pour les développeurs:** Voir [`README-VEO.md`](../README-VEO.md) pour la documentation technique.

---

## ✅ Checklist de Dépannage Rapide

Avant de demander de l'aide :

- [ ] J'ai vérifié que ma clé API est bien saisie
- [ ] J'ai essayé de régénérer une fois
- [ ] J'ai vérifié que le modèle existe (sur Google AI Studio)
- [ ] J'ai essayé avec un prompt plus simple
- [ ] J'ai vérifié ma connexion internet
- [ ] J'ai lu le message d'erreur en entier

---

**Version:** 1.0 - Décembre 2025  
**Mise à jour:** Pour refléter la distinction erreur modèle vs erreur clé
