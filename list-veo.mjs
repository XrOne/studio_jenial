// list-veo.mjs
// Petit script pour lister les modèles Veo disponibles avec ta clé Gemini

import dotenv from "dotenv";

// Charge les variables de .env.local (là où tu as mis GEMINI_API_KEY)
dotenv.config({ path: ".env.local" });

const key = process.env.GEMINI_API_KEY;

if (!key || key.trim().length < 20) {
  console.error(
    "❌ GEMINI_API_KEY manquante ou invalide. Ajoute-la dans ton .env.local sous la forme:\nGEMINI_API_KEY=\"ta_cle_veo\""
  );
  process.exit(1);
}

const MODELS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

async function main() {
  console.log("➡️ Appel à l'API Google pour lister les modèles (avec ta GEMINI_API_KEY)…");

  const res = await fetch(`${MODELS_ENDPOINT}?pageSize=100`, {
    method: "GET",
    headers: {
      "x-goog-api-key": key.trim(),
    },
  });

  console.log("⬅️ HTTP status:", res.status);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log("Réponse brute (non JSON) :");
    console.log(text);
    return;
  }

  if (!res.ok) {
    console.log("❌ Erreur renvoyée par l’API :");
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const models = data.models || [];
  const veoModels = models.filter((m) => m.name && m.name.includes("veo"));

  if (veoModels.length === 0) {
    console.log("⚠️ Aucun modèle Veo trouvé pour cette clé.");
  } else {
    console.log("✅ Modèles Veo disponibles pour cette clé :");
    for (const m of veoModels) {
      console.log(`- ${m.name}`);
      if (m.supportedGenerationMethods) {
        console.log(
          `  methods: ${m.supportedGenerationMethods.join(", ")}`
        );
      }
    }
  }
}

main().catch((err) => {
  console.error("💥 Erreur inattendue dans list-veo.mjs :", err);
});
