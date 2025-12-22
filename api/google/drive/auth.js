import { getAuthUrl, isDriveConfigured } from '../../../services/googleDriveService.js';

export default async function handler(req, res) {
    try {
        if (!isDriveConfigured()) {
            return res.status(503).json({ error: 'DRIVE_NOT_CONFIGURED' });
        }

        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'USER_ID_REQUIRED' });
        }

        const authUrl = getAuthUrl(userId);
        res.redirect(authUrl);
    } catch (error) {
        console.error('Drive auth error:', error.message);
        res.status(500).json({ error: 'AUTH_FAILED' });
    }
}
