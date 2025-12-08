import fetch from 'node-fetch';

async function testStorage() {
    console.log('🧪 Testing Storage API...');

    // 1. Test Health
    try {
        const health = await fetch('http://localhost:3001/api/health');
        console.log('Health:', await health.json());
    } catch (e) {
        console.error('❌ Server not running or not accessible');
        process.exit(1);
    }

    // 2. Test Save from URI (using a dummy valid video/file URL)
    // We'll use a small placeholder image/video or public URL
    const testUri = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

    console.log(`\n📤 Uploading from: ${testUri}`);

    try {
        const res = await fetch('http://localhost:3001/api/storage/save-from-uri', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uri: testUri,
                filename: `test-upload-${Date.now()}.mp4`,
                metadata: { source: 'test-script' }
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(JSON.stringify(err));
        }

        const data = await res.json();
        console.log('\n✅ Upload Success!');
        console.log(data);

    } catch (error) {
        console.error('\n❌ Upload Failed:', error.message);
    }
}

testStorage();
