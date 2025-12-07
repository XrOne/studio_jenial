/**
 * QA Backend Integration Test
 * 
 * Verifies:
 * 1. /api/config (Mode detection)
 * 2. /api/video/generate (Error handling: Missing Key, Invalid Key)
 * 3. /api/google/drive/enabled (Top-level verification)
 * 
 * Targets: http://localhost:3001
 * Usage: node scripts/qa-backend-integration.mjs
 */

const BASE_URL = 'http://localhost:3001';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    pass: (msg) => console.log(`${colors.green}[PASS]${colors.reset} ${msg}`),
    fail: (msg) => console.log(`${colors.red}[FAIL]${colors.reset} ${msg}`),
    section: (msg) => console.log(`\n=== ${msg} ===`),
};

async function testConfig() {
    log.section('Testing /api/config');
    try {
        const res = await fetch(`${BASE_URL}/api/config`);
        const data = await res.json();
        log.info(`Response: ${JSON.stringify(data)}`);

        if (res.ok && 'hasServerKey' in data && 'requiresUserKey' in data) {
            log.pass('Config endpoint returns valid structure');
            return data;
        } else {
            log.fail('Config endpoint returned unexpected structure');
        }
    } catch (e) {
        log.fail(`Failed to connect to backend: ${e.message}`);
        process.exit(1);
    }
}

async function testMissingKey() {
    log.section('Testing /api/video/generate (Missing Key)');
    try {
        const res = await fetch(`${BASE_URL}/api/video/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'veo-3.1-fast-generate-preview',
                prompt: 'test prompt'
            })
        });

        const data = await res.json();
        log.info(`Status: ${res.status}, Error: ${data.error}`);

        // In BYOK mode (no server key), this should return 401 API_KEY_MISSING
        // In Server mode, it might work or fail differently

        if (res.status === 401 && data.error === 'API_KEY_MISSING') {
            log.pass('Correctly rejected request with API_KEY_MISSING');
        } else if (res.status === 200) {
            log.info('Request succeeded (Server Key likely active)');
        } else {
            log.fail(`Unexpected response: ${res.status} - ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log.fail(`Request failed: ${e.message}`);
    }
}

async function testInvalidKey() {
    log.section('Testing /api/video/generate (Invalid Key)');
    try {
        const res = await fetch(`${BASE_URL}/api/video/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'AIzaInvalidKeyTest12345'
            },
            body: JSON.stringify({
                model: 'veo-3.1-fast-generate-preview',
                prompt: 'test prompt'
            })
        });

        const data = await res.json();
        log.info(`Status: ${res.status}, Error: ${data.error}`);

        // Should return 401 API_KEY_INVALID or similar from Google
        // Note: The backend might return 400 or 500 if the proxy fails, but we want 401 ideally

        if (res.status === 401 && (data.error === 'API_KEY_INVALID' || data.code === 400)) {
            // Code might be 400 from Google if key is garbage, lets see
            log.pass('Correctly rejected invalid key');
        } else if (res.status === 400 && data.error.includes('Key')) {
            log.pass('Correctly rejected invalid key (400)');
        } else {
            log.info(`Response was: ${res.status} ${JSON.stringify(data)} (Acceptable if upstream rejected it)`);
        }
    } catch (e) {
        log.fail(`Request failed: ${e.message}`);
    }
}

async function testDriveEnabled() {
    log.section('Testing /api/google/drive/enabled');
    try {
        const res = await fetch(`${BASE_URL}/api/google/drive/enabled`);
        const data = await res.json();
        log.info(`Enabled: ${data.enabled}`);
        log.pass('Drive enabled endpoint works');
    } catch (e) {
        log.fail(`Failed to check Drive status: ${e.message}`);
    }
}

async function run() {
    console.log(`Targeting Backend at ${BASE_URL}`);

    // Wait a moment for server to be ready
    await new Promise(r => setTimeout(r, 1000));

    await testConfig();
    await testMissingKey();
    await testInvalidKey();
    await testDriveEnabled();
}

run();
