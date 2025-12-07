const key = 'AIzaSyCS2O8suTrwd2oUEIj9xKDdTGmtkenAWiM';

async function listVeoModels() {
    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
            headers: { 'x-goog-api-key': key }
        });
        const data = await res.json();

        console.log('=== VEO MODELS ===');
        if (data.models) {
            const veoModels = data.models.filter(m => m.name.includes('veo'));
            if (veoModels.length === 0) {
                console.log('No Veo models found! Check if your API key has Veo access.');
            } else {
                veoModels.forEach(m => {
                    console.log(`- ${m.name}`);
                    console.log(`  Methods: ${m.supportedGenerationMethods?.join(', ')}`);
                });
            }
        } else {
            console.log('Error:', data.error?.message || 'Unknown error');
        }
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}

listVeoModels();
