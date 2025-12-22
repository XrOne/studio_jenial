/**
 * /api/google/drive/enabled - Check if Drive is configured
 */
export default function handler(req, res) {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    const enabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

    res.status(200).json({
        enabled: enabled
    });
}
