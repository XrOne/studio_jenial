import dotenv from "dotenv";

// Load .env.local first, then .env as fallback
dotenv.config({ path: ".env.local" });
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey.length < 20) {
    console.error("❌ GEMINI_API_KEY manquante ou invalide. Vérifie ton .env.local.");
    console.error("   La clé doit être définie dans .env.local comme:");
    console.error("   GEMINI_API_KEY=ta_cle_ici");
    process.exit(1);
}

const payload = {
    prompt: "a camel washing dishes, cinematic, golden hour, 16:9",
    model: "veo-3.1-generate-preview",
    parameters: {
        aspectRatio: "16:9",
        resolution: "720p"
    }
};

async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  TEST QA - Veo 3.1 Endpoint Validation");
    console.log("═══════════════════════════════════════════════════════");
    console.log("");
    console.log("➡️  Endpoint: POST http://localhost:3001/api/video/generate");
    console.log("➡️  Model:    veo-3.1-generate-preview");
    console.log("➡️  Prompt:   a camel washing dishes, cinematic, golden hour, 16:9");
    console.log("");
    console.log("Envoi de la requête...");
    console.log("");

    try {
        const res = await fetch("http://localhost:3001/api/video/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify(payload),
        });

        console.log("⬅️  Status HTTP:", res.status, res.statusText);
        console.log("");

        const text = await res.text();
        console.log("⬅️  Response Body:");
        console.log("───────────────────────────────────────────────────────");

        try {
            const json = JSON.parse(text);
            console.log(JSON.stringify(json, null, 2));
        } catch {
            console.log(text);
        }

        console.log("───────────────────────────────────────────────────────");
        console.log("");

        // Analyze result
        if (res.status >= 200 && res.status < 300) {
            console.log("✅ SUCCESS: Requête acceptée par le serveur");
            try {
                const json = JSON.parse(text);
                if (json.operationName) {
                    console.log(`✅ Operation créée: ${json.operationName}`);
                    console.log("   → Utilise /api/video/status pour suivre la progression");
                }
            } catch { }
        } else if (res.status === 404) {
            console.log("❌ FAILED: Modèle non trouvé (404)");
            console.log("   → Le modèle veo-3.1-generate-preview n'est peut-être pas disponible");
            console.log("   → Vérifie que ton compte a accès à Veo 3.1");
        } else if (res.status === 401) {
            console.log("❌ FAILED: Erreur d'authentification (401)");
            console.log("   → Vérifie que ta clé API est valide");
        } else if (res.status === 429) {
            console.log("❌ FAILED: Quota dépassé (429)");
            console.log("   → Attends quelques minutes avant de réessayer");
        } else {
            console.log(`❌ FAILED: Erreur HTTP ${res.status}`);
        }

        console.log("");
        console.log("═══════════════════════════════════════════════════════");

        process.exit(res.status >= 200 && res.status < 300 ? 0 : 1);
    } catch (err) {
        console.error("💥 Erreur réseau ou serveur non démarré:");
        console.error(err.message);
        console.log("");
        console.log("Vérifie que le serveur backend est démarré:");
        console.log("  npm run server");
        console.log("");
        process.exit(1);
    }
}

main();
