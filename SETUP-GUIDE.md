# 🚀 Guide de Configuration - Studio Jenial

Ce guide vous aide à configurer Studio Jenial pour fonctionner avec Supabase et les APIs Gemini.

## Prérequis

✅ Node.js 18+ installé  
✅ Compte Google avec accès à l'API Gemini  
✅ Projet Supabase (gratuit)

---

## Étape 1: Créer un Projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte (gratuit)
3. Créez un nouveau projet
4. Notez votre **URL du projet** et **anon key** (dans Settings > API)

---

## Étape 2: Configurer les Buckets Supabase

### Option A: Via l'Interface Web (Recommandé)

1. Dans votre projet Supabase, allez dans **Storage**
2. Créez 3 buckets publics:
   - `videos`
   - `images`
   - `thumbnails`
3. Pour chaque bucket, activez "Public bucket" dans les settings

### Option B: Via SQL (Automatique)

1. Dans votre projet Supabase, allez dans **SQL Editor**
2. Créez une nouvelle query
3. Copiez-collez le contenu de `supabase-setup.sql`
4. Exécutez la requête

---

## Étape 3: Configuration Locale

1. **Copiez le fichier de configuration:**
   ```bash
   copy .env.example .env.local
   ```

2. **Éditez `.env.local` avec vos credentials:**
   ```bash
   # Supabase Configuration (OBLIGATOIRE)
   VITE_SUPABASE_URL=https://votre-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=votre_anon_key_ici
   
   # Server Port
   PORT=3001
   ```

3. **Trouvez vos credentials Supabase:**
   - URL: Dans Settings > API > Project URL
   - ANON KEY: Dans Settings > API > Project API keys > `anon` `public`

---

## Étape 4: Installer les Dépendances

```bash
npm install
```

---

## Étape 5: Tester en Local

```bash
# Démarrer le serveur backend + frontend
npm run start
```

Le serveur démarre sur:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

---

## Étape 6: Configurer votre Clé API Gemini

1. Ouvrez http://localhost:5173
2. Une popup apparaît pour entrer votre clé API
3. Obtenez votre clé sur [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Collez la clé (commence par `AIza...`)

> ⚠️ **Important**: La clé est stockée uniquement dans votre navigateur (localStorage)

---

## Étape 7: Tester les Fonctionnalités

### Test Backend (Optionnel)
```bash
# Terminal 1: Démarrer le serveur
npm run server

# Terminal 2: Lancer les tests
set TEST_API_KEY=votre_cle_gemini_ici
node test-api.js
```

### Test Frontend
1. Générez une image avec **Banana Pro** (Gemini 3.0 Pro Image)
2. Générez une vidéo avec **Veo 3.1**
3. Vérifiez que les médias apparaissent dans votre Supabase Storage

---

## Étape 8: Déploiement sur Vercel

### Préparer le Déploiement

1. **Poussez sur GitHub:**
   ```bash
   git add .
   git commit -m "Configure Supabase integration"
   git push origin main
   ```

2. **Importez dans Vercel:**
   - Allez sur [vercel.com](https://vercel.com)
   - Cliquez "Import Project"
   - Sélectionnez votre repo GitHub
   
3. **Configurez les Variables d'Environnement:**
   Dans Vercel > Settings > Environment Variables, ajoutez:
   ```
   VITE_SUPABASE_URL=https://votre-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=votre_anon_key_ici
   ```

4. **Déployez!**
   - Vercel déploie automatiquement
   - Testez sur l'URL de production

---

## 🔍 Vérification Post-Déploiement

Testez ces fonctionnalités sur votre site déployé:

- [ ] Entrée de clé API Gemini
- [ ] Génération d'image (Banana Pro)
- [ ] Génération de vidéo (Veo 3.1)
- [ ] Upload automatique vers Supabase
- [ ] Téléchargement des médias depuis Supabase
- [ ] Library de shots (local + cloud)

---

## 🆘 Résolution de Problèmes

### Erreur "Supabase is not configured"
- Vérifiez que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définis
- Redémarrez le serveur après modification de `.env.local`

### Erreur "API_KEY_MISSING"
- Entrez votre clé Gemini via la popup
- Vérifiez que la clé commence par `AIza`

### Erreur "Failed to upload to Supabase"
- Vérifiez que les buckets existent (videos, images, thumbnails)
- Vérifiez que les buckets sont publics
- Vérifiez vos credentials Supabase

### Les vidéos ne se génèrent pas
- Vérifiez que votre clé API a accès à Veo (beta access requis)
- Consultez les logs de la console développeur (F12)
- Vérifiez le statut du serveur: http://localhost:3001/api/health

---

## 📚 Modèles Supportés

### Texte & Chat
- `gemini-3-pro-preview` - Gemini 3.0 Pro (reasoning)
- `gemini-2.5-flash` - Rapide et efficace

### Génération d'Images
- `gemini-3-pro-image-preview` - **Banana Pro** (haute qualité)
- `gemini-2.5-flash-image` - Banana (rapide)

### Génération de Vidéos
- `veo-3.1-fast` - Rapide (2-3 min)
- `veo-3.1` - Qualité équilibrée
- `veo-3.0` - Modèle original

---

## 💡 Conseils

- **Testez d'abord en local** avant de déployer
- **Les vidéos prennent 2-5 minutes** à générer (c'est normal)
- **Supabase gratuit** offre 1GB de stockage
- **Surveillez votre usage API** sur Google Cloud Console

---

## 🎉 Félicitations!

Votre studio est configuré et prêt à créer des vidéos avec Veo 3.1 et des images avec Banana Pro!

**Bon amusement! 🎬**
