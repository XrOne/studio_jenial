# 🔧 Guide de Démarrage Manuel - Studio Jenial

## ⚠️ Problème Identifié

Le serveur Node.js se ferme immédiatement après le démarrage. C'est probablement lié à la configuration des ES modules.

## ✅ Solution: Démarrage Manuel en Deux Terminaux

### Terminal 1: Backend (Port 3001)

Ouvrez PowerShell dans `K:\studio_jenial` et exécutez:

```powershell
# Option A: Via npm
npm run server

# Option B: Directement avec node
node server.js
```

**Si le serveur se ferme immédiatement**, essayez cette commande alternative:

```powershell
# Forcer le serveur à rester ouvert
$env:NODE_ENV="development"; node --experimental-modules server.js
```

Le serveur DOIT afficher:
```
🎬 ════════════════════════════════════════════
   STUDIO JENIAL - Backend Server
════════════════════════════════════════════

   📍 Local:    http://localhost:3001
   🔍 Health:   http://localhost:3001/api/health
```

**Si rien ne s'affiche et que le serveur se ferme**, il faut reconstruire le backend (voir section "Plan B" ci-dessous).

---

### Terminal 2: Frontend (Port 5173)

Dans un **NOUVEAU terminal PowerShell** (laissez le premier ouvert) :

```powershell
cd K:\studio_jenial
npm run dev
```

Le frontend DOIT afficher:
```
VITE v6.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

### Tester la Connexion

1. **Ouvrez votre navigateur**: http://localhost:5173
2. **Ouvrez la console (F12)**: Tab "Console"
3. **Vérifiez les logs**:
   - ✅ Pas d'erreurs de connexion
   - ✅ "Supabase configured" ou similaire

---

## 🔥 Plan B: Reconstruire le Backend

Si le serveur ne démarre toujours pas, on doit reconstruire un backend plus simple:

### Option 1: Backend Express Simple (Sans ES Modules)

Créez `server-simple.js`:

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Studio Jenial Backend' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'BYOK',
    supabase: !!process.env.VITE_SUPABASE_URL
  });
});

// Proxy vers Google Gemini
app.post('/api/generate-content', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent(req.body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('🎬 Backend Server Running');
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔍 http://localhost:${PORT}/api/health`);
  console.log('');
});
```

**Modifiez `package.json`** :
```json
"type": "commonjs",
```

Démarrez:
```powershell
node server-simple.js
```

---

### Option 2: Utiliser Vercel Dev (Développement Local)

```powershell
# Installer Vercel CLI
npm install -g vercel

# Démarrer en mode dev
vercel dev
```

Cela lancera automatiquement le backend ET le frontend.

---

## 🧪 Tests Rapides

Une fois les deux serveurs lancés:

### Test 1: Health Check
```powershell
curl http://localhost:3001/api/health
```
Résultat attendu: `{"status":"ok","mode":"BYOK",...}`

### Test 2: Frontend
Ouvrez http://localhost:5173 et vérifiez qu'il n'y a pas d'erreurs dans la console

---

## 📞 Prochaines Actions

**Dites-moi**:
1. Est-ce que le backend démarre maintenant avec `npm run server` ?
2. Voyez-vous les logs du serveur dans le terminal ?
3. Ou préférez-vous que je reconstruise le backend avec le Plan B ?

Je suis prêt à vous aider ! 🚀
