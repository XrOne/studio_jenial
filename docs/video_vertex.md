# Intégration Vertex AI (Veo) - Documentation

## Vue d'ensemble
Ce module ajoute le support pour la génération de vidéos via **Google Cloud Vertex AI** (modèles Veo), en plus de l'intégration existante Gemini API.

## Configuration Requise

Pour utiliser Vertex AI, vous devez fournir :
1. **Project ID** : L'identifiant de votre projet Google Cloud.
2. **Location** : La région (ex: `us-central1`).
3. **Access Token** : Un jeton d'accès OAuth2 valide.

### Comment obtenir un Access Token ?
Si vous avez installé `gcloud` CLI :
```bash
gcloud auth print-access-token
```

## Utilisation dans Studio Jenial

1. Cliquez sur l'icône **Clé (API Key)** en haut à droite.
2. Ouvrez la section **"Configure Vertex AI (Optional)"**.
3. Remplissez les champs (Project ID, Location, Access Token).
4. Dans l'interface de génération vidéo ("Video Result"), sélectionnez **"Vertex AI (Veo)"** dans le menu déroulant "Video Engine".
5. Cliquez sur **Generate Video**.

## Architecture Technique

- **Backend** : Nouvelle route `/api/video/vertex/generate` qui utilise `@google-cloud/aiplatform`.
- **Frontend** : Nouveau service `vertexVideoService.ts`.
- **Non-Régression** : L'intégration est purement additive. Si "Gemini API" est sélectionné (par défaut), le code exécute strictement la logique originale.

## Dépannage

- **Erreur 401/403** : Vérifiez que votre Access Token est valide et n'a pas expiré (ils durent généralement 1 heure).
- **Erreur 404** : Vérifiez que le `Project ID` est correct et que l'API Vertex AI est activée sur votre projet.
