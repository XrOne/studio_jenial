import fetch from 'node-fetch';

// Récupérer la clé API des arguments
const apiKey = process.argv[2];

if (!apiKey) {
    console.error('❌ Veuillez fournir votre clé API en argument');
    console.error('Usage: node test-veo-connection.js VOTRE_CLE_API');
    process.exit(1);
}

const MODEL = 'veo-3.1-generate-preview';
const PROMPT = 'A bird flying';

async function testEndpoint(version, method) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${MODEL}:${method}?key=${apiKey}`;

    console.log(`\n🧪 Test ${version} / ${method}...`);
    console.log(`URL: https://generativelanguage.googleapis.com/${version}/models/${MODEL}:${method}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: PROMPT }] }]
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ SUCCÈS !');
            console.log('Structure réponse:', Object.keys(data));
            return true;
        } else {
            console.log('❌ ÉCHEC');
            console.log('Status:', response.status);
            console.log('Erreur:', data.error?.message || data);
            return false;
        }
    } catch (error) {
        console.log('❌ ERREUR RÉSEAU:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🔍 DÉBUT DU DIAGNOSTIC VEO 3.1');
    console.log('--------------------------------');

    // Test 1: v1beta generateContent (Ce qu'on utilise actuellement)
    await testEndpoint('v1beta', 'generateContent');

    // Test 2: v1alpha generateContent
    await testEndpoint('v1alpha', 'generateContent');

    // Test 3: v1alpha generateVideos (Ancienne méthode)
    // Note: generateVideos a une structure de body différente, on teste juste si l'endpoint existe
    const urlVideo = `https://generativelanguage.googleapis.com/v1alpha/models/${MODEL}:generateVideos?key=${apiKey}`;
    console.log(`\n🧪 Test v1alpha / generateVideos...`);
    try {
        const response = await fetch(urlVideo, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: PROMPT // Structure différente pour generateVideos
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log('✅ SUCCÈS (generateVideos) !');
        } else {
            console.log('❌ ÉCHEC (generateVideos)');
            console.log('Erreur:', data.error?.message);
        }
    } catch (e) { console.log(e.message); }

    console.log('\n--------------------------------');
    console.log('🏁 DIAGNOSTIC TERMINÉ');
}

runTests();
