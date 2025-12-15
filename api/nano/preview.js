/**
 * /api/nano/preview - Nano Banana Pro Preview endpoint
 * Vercel-compatible handler wrapper
 */
import { handlePreview } from './index.js';

export default async function handler(req, res) {
    return handlePreview(req, res);
}
