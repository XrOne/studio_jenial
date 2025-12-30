/**
 * Google Drive Service
 * 
 * Handles OAuth2 authentication and file operations with Google Drive.
 * Users can save generated videos/images directly to their own Drive.
 * No files are stored persistently on our servers.
 * 
 * NOTE: googleapis is optional - service degrades gracefully without it
 */

// Conditional import - allows running without googleapis installed
let google = null;
try {
    const googleapis = await import('googleapis');
    google = googleapis.google;
} catch (e) {
    console.warn('[GoogleDrive] googleapis not installed - Drive features disabled');
}

// Conditional Supabase import
let createClient = null;
try {
    const supabaseModule = await import('@supabase/supabase-js');
    createClient = supabaseModule.createClient;
} catch (e) {
    console.warn('[GoogleDrive] @supabase/supabase-js not installed - Supabase features disabled');
}

// Create Supabase client for backend
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey && createClient) 
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    }) 
    : null;

// Google OAuth configuration from environment
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/drive/callback';

// Scopes for Drive access (minimal: only files created by this app)
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Check if Google Drive integration is configured
 */
export const isDriveConfigured = () => {
    return !!(google && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
};

/**
 * Create OAuth2 client
 */
export const createOAuth2Client = () => {
    if (!google) {
        throw new Error('googleapis not installed - run: npm install googleapis');
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth credentials not configured');
    }

    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );
};

/**
 * Generate authorization URL for user to connect their Drive
 */
export const getAuthUrl = (userId) => {
    const oauth2Client = createOAuth2Client();

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: userId
    });
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (code) => {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

import fs from 'fs';
import path from 'path';

// Local token storage path
const TOKEN_PATH = path.join(process.cwd(), '.drivetokens.json');

/**
 * Helper to read local tokens
 */
const readLocalTokens = () => {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const data = fs.readFileSync(TOKEN_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn('Failed to read local tokens:', e);
    }
    return {};
};

/**
 * Helper to write local tokens
 */
const writeLocalTokens = (tokens) => {
    try {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    } catch (e) {
        console.warn('Failed to write local tokens:', e);
    }
};

/**
 * Save tokens for a user in database (with local fallback)
 */
export const saveTokensForUser = async (userId, tokens) => {
    const { access_token, refresh_token, expiry_date } = tokens;

    if (supabase) {
        const { data, error } = await supabase
            .from('user_google_drive_tokens')
            .upsert({
                user_id: userId,
                access_token,
                refresh_token,
                expiry_date,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (!error) return data;
        console.warn('Supabase save failed, falling back to local storage:', error.message);
    }

    const allTokens = readLocalTokens();
    allTokens[userId] = { access_token, refresh_token, expiry_date, updated_at: new Date().toISOString() };
    writeLocalTokens(allTokens);
    console.log(`[Drive] Tokens saved locally for user ${userId}`);
    return allTokens[userId];
};

/**
 * Get tokens for a user from database (with local fallback)
 */
export const getTokensForUser = async (userId) => {
    if (supabase) {
        const { data, error } = await supabase
            .from('user_google_drive_tokens')
            .select('access_token, refresh_token, expiry_date')
            .eq('user_id', userId)
            .single();

        if (data && !error) return data;
        console.warn('Supabase fetch failed/empty, checking local storage...');
    }

    const allTokens = readLocalTokens();
    const userTokens = allTokens[userId];

    if (userTokens) {
        console.log(`[Drive] Tokens found locally for user ${userId}`);
        return userTokens;
    }

    return null;
};

/**
 * Check if user has Drive connected
 */
export const isDriveConnected = async (userId) => {
    const tokens = await getTokensForUser(userId);
    return !!tokens;
};

/**
 * Create authenticated Drive client for a user
 */
export const createDriveClient = async (userId) => {
    if (!google) {
        throw new Error('googleapis not installed');
    }

    const tokens = await getTokensForUser(userId);

    if (!tokens) {
        throw new Error('DRIVE_NOT_CONNECTED');
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
    });

    oauth2Client.on('tokens', async (newTokens) => {
        await saveTokensForUser(userId, {
            access_token: newTokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: newTokens.expiry_date
        });
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
};

/**
 * Ensure "Studio Jenial" folder exists in user's Drive
 */
export const ensureStudioFolder = async (drive, userId) => {
    try {
        const query = "mimeType='application/vnd.google-apps.folder' and name='Studio Jenial' and trashed=false";

        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (res.data.files && res.data.files.length > 0) {
            console.log(`[Drive] Found existing Studio Jenial folder for user ${userId}`);
            return res.data.files[0].id;
        }

        const folderMetadata = {
            name: 'Studio Jenial',
            mimeType: 'application/vnd.google-apps.folder'
        };

        const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id'
        });

        console.log(`[Drive] Created Studio Jenial folder for user ${userId}`);
        return folder.data.id;
    } catch (error) {
        console.error('[Drive] Error ensuring folder:', error.message);
        return null;
    }
};

/**
 * Upload a file to user's Drive from a URL
 */
export const uploadFileToDrive = async (userId, fileUrl, fileName, mimeType) => {
    const drive = await createDriveClient(userId);
    const folderId = await ensureStudioFolder(drive, userId);

    const response = await fetch(fileUrl);
    if (!response.ok || !response.body) {
        throw new Error('SOURCE_DOWNLOAD_FAILED');
    }

    const fileMetadata = {
        name: fileName,
        mimeType
    };

    if (folderId) {
        fileMetadata.parents = [folderId];
        console.log(`[Drive] Uploading to Studio Jenial folder: ${fileName}`);
    } else {
        console.log(`[Drive] Uploading to root (folder creation failed): ${fileName}`);
    }

    const media = {
        mimeType,
        body: response.body
    };

    const file = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, webViewLink, webContentLink'
    });

    return {
        fileId: file.data.id,
        webViewLink: file.data.webViewLink,
        webContentLink: file.data.webContentLink
    };
};

/**
 * Remove user's Drive connection
 */
export const disconnectDrive = async (userId) => {
    if (!supabase) {
        const allTokens = readLocalTokens();
        delete allTokens[userId];
        writeLocalTokens(allTokens);
        return;
    }

    const { error } = await supabase
        .from('user_google_drive_tokens')
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error('Error disconnecting Drive:', error.message);
        throw error;
    }
};

/**
 * Create a Resumable Upload Session
 */
export const createResumableUpload = async (userId, fileName, mimeType) => {
    const tokens = await getTokensForUser(userId);
    if (!tokens) throw new Error('DRIVE_NOT_CONNECTED');

    const drive = await createDriveClient(userId);
    const folderId = await ensureStudioFolder(drive, userId);

    const metadata = {
        name: fileName,
        mimeType: mimeType
    };

    if (folderId) {
        metadata.parents = [folderId];
    }

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': ''
        },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to initiate upload: ${response.status} ${errText}`);
    }

    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
        throw new Error('No upload URL returned from Drive API');
    }

    return uploadUrl;
};
