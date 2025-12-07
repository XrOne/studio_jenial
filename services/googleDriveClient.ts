/**
 * Google Drive Frontend Service
 * 
 * Handles Drive connection status and file uploads from the frontend
 */

import { supabase } from './supabaseClient';

/**
 * Check if Google Drive integration is enabled on the server
 */
export const isDriveEnabled = async (): Promise<boolean> => {
    try {
        const res = await fetch('/api/google/drive/enabled');
        const data = await res.json();
        return data.enabled === true;
    } catch {
        return false;
    }
};

/**
 * Check if current user has connected their Drive
 */
export const isDriveConnected = async (): Promise<boolean> => {
    try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;

        if (!token) return false;

        const res = await fetch('/api/google/drive/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await res.json();
        return data.connected === true;
    } catch {
        return false;
    }
};

/**
 * Start OAuth flow to connect Drive
 * Opens in current window (will redirect back after auth)
 */
export const connectDrive = async (): Promise<void> => {
    const session = await supabase?.auth.getSession();
    const userId = session?.data.session?.user?.id;

    if (!userId) {
        throw new Error('User not authenticated');
    }

    // Redirect to OAuth endpoint
    window.location.href = `/api/google/drive/auth?userId=${userId}`;
};

/**
 * Upload a file to user's Google Drive
 */
export const uploadToDrive = async (
    fileUrl: string,
    fileName: string,
    mimeType: string = 'video/mp4'
): Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }> => {
    try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;

        if (!token) {
            return { success: false, error: 'NOT_AUTHENTICATED' };
        }

        const res = await fetch('/api/google/drive/upload-from-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fileUrl, fileName, mimeType })
        });

        const data = await res.json();

        if (!res.ok) {
            return { success: false, error: data.error || 'UPLOAD_FAILED' };
        }

        return {
            success: true,
            fileId: data.fileId,
            webViewLink: data.webViewLink
        };
    } catch (error) {
        return { success: false, error: 'NETWORK_ERROR' };
    }
};
