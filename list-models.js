import fetch from 'node-fetch';

const apiKey = process.argv[2];

if (!apiKey) {
    console.error('❌ Clé API manquante');
    process.exit(1);
}

async function listModels() {
    console.log('🔍 Recherche des modèles disponibles...');

    // Essayer v1beta
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Erreur:', data.error?.message || data);
            return;
        }

        console.log('\n📋 LISTE DES MODÈLES (v1beta):');
        console.log('--------------------------------');

        const veoModels = data.models?.filter(m => m.name.toLowerCase().includes('veo'));

        if (veoModels && veoModels.length > 0) {
            console.log('🎉 MODÈLES VEO TROUVÉS :');
            veoModels.forEach(m => {
                console.log(`\nNom: ${m.name}`);
                console.log(`Méthodes supportées: ${m.supportedGenerationMethods?.join(', ')}`);
            });
        } else {
            console.log('⚠️ AUCUN modèle "veo" trouvé dans la liste.');
            console.log('Voici les 5 premiers modèles trouvés pour vérifier l\'accès :');
            data.models?.slice(0, 5).forEach(m => console.log(`- ${m.name}`));
        }

    } catch (error) {
        console.error('❌ Erreur réseau:', error.message);
    }
}

listModels();
