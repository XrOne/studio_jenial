/**
 * Google Files API Proxy Endpoint
 * 
 * Security: This proxies the resumable upload initialization to Google Files API.
 * The API key is handled server-side, never exposed to the frontend.
 */

// Get API key helper (same as main server.js)
const getApiKey = (req) => {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 20) {
        return process.env.GEMINI_API_KEY.trim();
    }
    const userKey = req.headers['x-api-key'];
    if (userKey && typeof userKey === 'string' && userKey.trim().length >= 20) {
        return userKey.trim();
    }
    const error = new Error('API_KEY_MISSING');
    error.code = 'API_KEY_MISSING';
    error.statusCode = 401;
    throw error;
};

const GOOGLE_FILES_API = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const apiKey = getApiKey(req);
        const { displayName, mimeType, fileSize } = req.body;

        if (!displayName || !mimeType || !fileSize) {
            return res.status(400).json({ error: 'Missing required fields: displayName, mimeType, fileSize' });
        }

        console.log(`[FilesAPI] Initializing upload: ${displayName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        // Step 1: Initialize resumable upload with Google
        const initResponse = await fetch(GOOGLE_FILES_API, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
                'X-Goog-Upload-Header-Content-Type': mimeType,
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey, // Key handled server-side
            },
            body: JSON.stringify({
                file: { displayName }
            }),
        });

        if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error('[FilesAPI] Init failed:', initResponse.status, errorText);
            return res.status(initResponse.status).json({
                error: `Google Files API error: ${initResponse.status}`,
                details: errorText
            });
        }

        // Get the upload URL from the response header
        const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');

        if (!uploadUrl) {
            console.error('[FilesAPI] No upload URL received');
            return res.status(500).json({ error: 'No upload URL received from Google Files API' });
        }

        console.log('[FilesAPI] Upload URL obtained successfully');

        // Return the pre-signed upload URL (client uploads directly, no key needed)
        return res.json({ uploadUrl });

    } catch (error) {
        console.error('[FilesAPI] Error:', error);

        if (error.code === 'API_KEY_MISSING') {
            return res.status(401).json({ error: 'API_KEY_MISSING' });
        }

        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
