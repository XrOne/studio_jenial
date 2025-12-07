/**
 * Quick Veo Endpoint Test
 * Tests the backend /api/video/generate endpoint locally
 */

const API_KEY = 'AIzaSyCS2O8suTrwd2oUEIj9xKDdTGmtkenAWiM';

async function testVeoEndpoint() {
    console.log('Testing Veo endpoint...\n');

    try {
        const response = await fetch('http://localhost:3001/api/video/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                model: 'veo-3.1-fast-generate-preview',
                prompt: 'A camel washing dishes, viewed from behind',
                parameters: {
                    aspectRatio: '16:9'
                }
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data.operationName) {
            console.log('\n✅ Operation started successfully!');
            console.log('   Operation name:', data.operationName);
        } else if (data.error) {
            console.log('\n❌ Error:', data.error);
        }
    } catch (error) {
        console.error('Request failed:', error.message);
    }
}

testVeoEndpoint();
