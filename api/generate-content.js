/**
 * /api/generate-content - Text generation endpoint
 * Uses Google GenAI SDK for chat/prompt generation
 */
import { GoogleGenAI } from '@google/genai';

// Safe JSON stringify that handles circular refs
const safeStringify = (obj) => {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    });
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-Gemini-Api-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get API key (server-managed or BYOK)
        let apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim().length < 20) {
            apiKey = req.headers['x-api-key'] || req.headers['x-gemini-api-key'];
        }

        if (!apiKey || apiKey.trim().length < 20) {
            return res.status(401).json({
                error: 'API_KEY_MISSING',
                message: 'Please provide a valid API key'
            });
        }

        const { model, contents, config } = req.body;

        console.log(`[ContentAPI] Request: model=${model}`);

        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

        const response = await ai.models.generateContent({
            model,
            contents,
            config
        });

        console.log('[ContentAPI] Response keys:', Object.keys(response || {}));

        // Send response safely
        try {
            const jsonStr = safeStringify(response);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(jsonStr);
        } catch (serErr) {
            console.error('[ContentAPI] Serialization failed');
            const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            res.status(200).json({ text, _fallback: true });
        }

    } catch (error) {
        const status = error?.status || error?.statusCode || 500;
        const message = error?.message || 'Unknown error';
        const code = error?.code || 'UNKNOWN';

        console.error('[ContentAPI] Error:', status, message, code);

        res.status(status).json({
            error: message,
            code,
            debug: { status }
        });
    }
}
