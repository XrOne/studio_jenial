import { exchangeCodeForTokens, saveTokensForUser } from '../../../services/googleDriveService.js';

export default async function handler(req, res) {
    try {
        const { code, state: userId } = req.query;

        if (!code || !userId) {
            return res.redirect('/studio?drive=error&reason=missing_params');
        }

        const tokens = await exchangeCodeForTokens(code);
        await saveTokensForUser(userId, tokens);

        res.redirect('/studio?drive=connected');
    } catch (error) {
        console.error('Drive callback error:', error.message);
        res.redirect('/studio?drive=error&reason=token_exchange');
    }
}
