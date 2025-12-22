import { createClient } from '@supabase/supabase-js';
import { uploadFileToDrive } from '../../../services/googleDriveService.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { fileUrl, fileName, mimeType } = req.body;

        if (!fileUrl || !fileName) {
            return res.status(400).json({ error: 'MISSING_PARAMS' });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
        }

        const token = authHeader.split(' ')[1];

        if (!supabase) {
            return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'INVALID_TOKEN' });
        }

        const result = await uploadFileToDrive(
            user.id,
            fileUrl,
            fileName,
            mimeType || 'video/mp4'
        );

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Drive upload error:', error.message);
        res.status(500).json({ error: 'UPLOAD_FAILED', details: error.message });
    }
}
