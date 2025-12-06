# Guide de Configuration Vercel

Pour que l'application fonctionne en production, vous devez configurer Vercel et Google Cloud.

## 1. Variables d'Environnement (Vercel)
Allez dans **Settings** -> **Environment Variables** sur Vercel et ajoutez :

| Variable | Où la trouver ? |
|----------|-----------------|
| `VITE_GOOGLE_CLIENT_ID` | Google Cloud Console (voir ci-dessous) |
| `VITE_VERTEX_PROJECT_ID` | Google Cloud Console (en haut à gauche, ex: `studio-jenial-beta`) |
| `VITE_SUPABASE_URL` | Votre fichier `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | Votre fichier `.env.local` |

## 2. Trouver le Google Client ID
1. Allez sur [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
2. Cherchez la section **ID clients OAuth 2.0**.
3. Copiez l'ID qui se termine par `.apps.googleusercontent.com`.

## 3. IMPORTANT : Autoriser le domaine Vercel
Pour que la connexion Google fonctionne sur le site en ligne :
1. Sur la page Credentials de Google Cloud, cliquez sur le nom de votre client (ex: "Studio Jenial Web").
2. Dans **Origines JavaScript autorisées**, cliquez sur "Ajouter un URI".
3. Collez l'URL de votre site Vercel (ex: `https://studio-jenial-xyz.vercel.app`).
4. Faites de même dans **URI de redirection autorisés**.
5. Cliquez sur **Enregistrer**.

> ⚠️ **Note** : La propagation peut prendre quelques minutes.
