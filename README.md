# 🎬 Studio Jenial - VEO Video Studio

<div align="center">

**A standalone video generation studio powered by Google's Veo 3.x and Gemini AI**

[![BYOK Mode](https://img.shields.io/badge/Mode-BYOK-green?style=for-the-badge)](https://aistudio.google.com/app/apikey)
[![Vercel Ready](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)

</div>

---

## 🔑 BYOK - Bring Your Own Key

This project operates in **BYOK mode**. Each user provides their own Gemini API key.

**What this means:**
- ✅ **No server-side API costs for you** (the deployer)
- ✅ Users pay for their own API usage
- ✅ Keys are stored locally in the user's browser only
- ✅ Zero risk of leaked credentials
- ✅ No usage limits from your side

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎬 **Video Generation** | Text-to-Video, Frames-to-Video, References-to-Video, Extend Video |
| 🎯 **Veo Models** | veo-3.1-fast, veo-3.1, veo-3.0 |
| 🎨 **Dogma System** | Artistic direction presets for consistent style |
| 👥 **Character Library** | Save and reuse character references |
| 📽️ **Shot Library** | Save favorite shots for later use |
| 🔗 **Sequence Assistant** | Chain prompts for longer narratives |
| ☁️ **Cloud Sync** | Optional Supabase integration |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Each user needs a [Gemini API key with Veo access](https://aistudio.google.com/app/apikey)

### Local Development

```bash
# 1. Clone the project
git clone https://github.com/YOUR_USERNAME/studio-jenial.git
cd studio-jenial

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run start
```

Open **http://localhost:5173** and enter your Gemini API key when prompted.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite frontend only |
| `npm run server` | Start Express backend only |
| `npm run start` | Start both frontend + backend |
| `npm run build` | Build for production |

---

## 🌐 Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repo
4. Deploy! (No environment variables needed for BYOK mode)

### 3. Optional: Enable Cloud Sync

If you want users to sync their shots to the cloud:

1. Create a [Supabase](https://supabase.com) project
2. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## 🏗️ Architecture

```
studio_jenial/
├── api/
│   └── index.js          # Vercel serverless entry
├── components/           # React components
│   ├── ApiKeyDialog.tsx  # BYOK key entry
│   ├── PromptSequenceAssistant.tsx
│   └── ...
├── services/
│   ├── geminiService.ts  # Gemini API client (BYOK)
│   └── supabaseClient.ts # Optional cloud sync
├── App.tsx               # Main application
├── server.js             # Express backend (BYOK proxy)
├── vercel.json           # Vercel routing
└── vite.config.ts        # Vite configuration
```

---

## 🎨 Included Dogmas

Two artistic direction presets are included:

1. **DA Déclics - Lumière & Ombre**
   - Black silhouette style with dramatic lighting
   
2. **Dogma: Satin & Statique**
   - Fashion/thriller aesthetic duality

Create your own in the app for consistent style across videos!

---

## 🔐 Security Note

- API keys are stored **only** in the user's browser `localStorage`
- Keys are transmitted directly to Google's servers via HTTPS
- The backend acts as a simple proxy, never storing keys
- No analytics or tracking of API usage

---

## 📝 Origin

Originally created from a Veo 3 brick in Google AI Studio, modified to be:
- Standalone and deployable on Vercel
- Operating in BYOK mode (no shared costs)
- Decoupled from Google AI Studio infrastructure

---

## 🤝 Tech Stack

- [React 19](https://react.dev) + [Vite](https://vitejs.dev)
- [TailwindCSS](https://tailwindcss.com)
- [Google Veo](https://deepmind.google/technologies/veo/) for video
- [Google Gemini](https://ai.google.dev/) for AI features
- [Supabase](https://supabase.com) for optional cloud sync

---

<div align="center">

**Made with 💜 by [Jenia AI Agency](https://jenia.ai)**

</div>
