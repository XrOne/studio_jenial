import { createClient } from '@supabase/supabase-js';
import { isDriveConnected } from '../../../services/googleDriveService.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ connected: false, reason: 'NOT_AUTHENTICATED' });
        }

        const token = authHeader.split(' ')[1];

        if (!supabase) {
            return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.json({ connected: false, reason: 'INVALID_TOKEN' });
        }

        const connected = await isDriveConnected(user.id);
        res.status(200).json({ connected });
    } catch (error) {
        console.error('Drive status error:', error.message);
        res.json({ connected: false, reason: 'ERROR' });
    }
}
