/**
 * /api/nano/retouch - Nano Banana Pro Retouch endpoint
 * Vercel-compatible handler wrapper
 */
import { handleRetouch } from './index.js';

export default async function handler(req, res) {
    return handleRetouch(req, res);
}
