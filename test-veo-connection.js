import fetch from 'node-fetch';

// Récupérer la clé API des arguments
const apiKey = process.argv[2];

if (!apiKey) {
    console.error('❌ Veuillez fournir votre clé API en argument');
    console.error('Usage: node test-veo-connection.js VOTRE_CLE_API');
    process.exit(1);
}

const MODEL = 'veo-3.1-fast-generate-preview';
const PROMPT = 'A bird flying';
const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function testPredictLongRunning() {
    console.log('\n🧪 Test predictLongRunning avec format instances...');
    console.log(`Model: ${MODEL}`);
    console.log(`Prompt: "${PROMPT}"`);

    const url = `${VEO_API_BASE}/models/${MODEL}:predictLongRunning`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey  // Header auth, not query param
            },
            body: JSON.stringify({
                instances: [{ prompt: PROMPT }]  // MUST use instances format
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ SUCCÈS !');
            console.log('Operation name:', data.name);
            return data.name;
        } else {
            console.log('❌ ÉCHEC');
            console.log('Status:', response.status);
            console.log('Erreur:', data.error?.message || JSON.stringify(data));
            return null;
        }
    } catch (error) {
        console.log('❌ ERREUR RÉSEAU:', error.message);
        return null;
    }
}

async function pollOperation(operationName) {
    console.log('\n🔄 Polling operation...');

    const pollUrl = `${VEO_API_BASE}/${operationName}`;

    const response = await fetch(pollUrl, {
        headers: {
            'x-goog-api-key': apiKey
        }
    });

    const data = await response.json();

    if (!response.ok) {
        console.log('❌ Poll error:', data.error?.message);
        return null;
    }

    console.log('Done:', data.done);
    if (data.done) {
        const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        console.log('Video URI:', videoUri);
        return { done: true, videoUri };
    }

    return { done: false };
}

async function runTests() {
    console.log('🔍 DÉBUT DU DIAGNOSTIC VEO');
    console.log('================================');
    console.log('Format: predictLongRunning + instances');
    console.log('Auth: x-goog-api-key header');
    console.log('================================');

    // Test: Start generation
    const operationName = await testPredictLongRunning();

    if (operationName) {
        // Wait a bit and poll once
        console.log('\n⏳ Attente 5s avant poll...');
        await new Promise(r => setTimeout(r, 5000));

        const status = await pollOperation(operationName);
        if (status && !status.done) {
            console.log('\n💡 La génération est en cours.');
            console.log('   Utilisez scripts/test-veo-smoke.mjs pour un test complet.');
        }
    }

    console.log('\n================================');
    console.log('🏁 DIAGNOSTIC TERMINÉ');
}

runTests();
