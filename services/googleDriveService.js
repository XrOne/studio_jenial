/**
 * Google Drive Service
 * 
 * Handles OAuth2 authentication and file operations with Google Drive.
 * Users can save generated videos/images directly to their own Drive.
 * No files are stored persistently on our servers.
 */

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for backend
// Prioritize backend-only env vars (Service Role)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Export the client so server.js can use it
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
}) : null;

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
    return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
};

/**
 * Create OAuth2 client
 */
export const createOAuth2Client = () => {
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
        prompt: 'consent', // Force consent to get refresh token
        state: userId // Pass userId to callback
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

    // Try Supabase first
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

    // Fallback to local file
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
    // Try Supabase first
    if (supabase) {
        const { data, error } = await supabase
            .from('user_google_drive_tokens')
            .select('access_token, refresh_token, expiry_date')
            .eq('user_id', userId)
            .single();

        if (data && !error) return data;
        console.warn('Supabase fetch failed/empty, checking local storage...');
    }

    // Fallback to local file
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

    // Set up token refresh handler
    oauth2Client.on('tokens', async (newTokens) => {
        // Save new access token when refreshed
        await saveTokensForUser(userId, {
            access_token: newTokens.access_token,
            refresh_token: tokens.refresh_token, // Keep existing refresh token
            expiry_date: newTokens.expiry_date
        });
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
};

/**
 * Ensure "Studio Jenial" folder exists in user's Drive
 * Creates the folder if it doesn't exist, returns folder ID
 */
export const ensureStudioFolder = async (drive, userId) => {
    try {
        // Search for existing folder
        const query = "mimeType='application/vnd.google-apps.folder' and name='Studio Jenial' and trashed=false";

        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        // Return existing folder
        if (res.data.files && res.data.files.length > 0) {
            console.log(`[Drive] Found existing Studio Jenial folder for user ${userId}`);
            return res.data.files[0].id;
        }

        // Create new folder
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
        // If folder creation fails, return null to upload to root
        return null;
    }
};

/**
 * Upload a file to user's Drive from a URL (streaming, no disk storage)
 */
export const uploadFileToDrive = async (userId, fileUrl, fileName, mimeType) => {
    const drive = await createDriveClient(userId);

    // Ensure Studio Jenial folder exists
    const folderId = await ensureStudioFolder(drive, userId);

    // Stream download from URL
    const response = await fetch(fileUrl);
    if (!response.ok || !response.body) {
        throw new Error('SOURCE_DOWNLOAD_FAILED');
    }

    // Upload to Drive (in Studio Jenial folder if available)
    const fileMetadata = {
        name: fileName,
        mimeType
    };

    // Add folder parent if folder exists
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
 * Remove user's Drive connection (optional: for account cleanup)
 */
export const disconnectDrive = async (userId) => {
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
 * Create a Resumable Upload Session for a file
 * Returns the session URI (uploadUrl) that the frontend can PUT to directly
 */
export const createResumableUpload = async (userId, fileName, mimeType) => {
    const tokens = await getTokensForUser(userId);
    if (!tokens) throw new Error('DRIVE_NOT_CONNECTED');

    // Manually ensure folder (using raw API calls since we need the ID)
    // We can reuse ensureStudioFolder if we already have the drive client,
    // but here we might want to avoid full client overhead if we are just doing raw fetch? 
    // Actually, let's just use createDriveClient -> ensureStudioFolder because it handles logic well.
    const drive = await createDriveClient(userId);
    const folderId = await ensureStudioFolder(drive, userId);

    const metadata = {
        name: fileName,
        mimeType: mimeType
    };

    if (folderId) {
        metadata.parents = [folderId];
    }

    // Initiate Resumable Upload
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': '' // Unknown length initially is fine, or pass if known
        },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to initiate upload: ${response.status} ${errText}`);
    }

    // The upload URL is in the Location header
    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
        throw new Error('No upload URL returned from Drive API');
    }

    return uploadUrl;
};
