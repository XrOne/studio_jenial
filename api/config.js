/**
 * /api/config - Lightweight config endpoint
 * CRITICAL: No heavy imports - this must always respond
 */
export default function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-Gemini-Api-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const hasServerKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 20);

        res.status(200).json({
            status: 'ok',
            hasServerKey,
            mode: hasServerKey ? 'server-managed' : 'BYOK',
            requiresUserKey: !hasServerKey,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('[Config] Error:', error.message);
        // Safe fallback
        res.status(200).json({
            status: 'ok',
            hasServerKey: false,
            requiresUserKey: true
        });
    }
}
