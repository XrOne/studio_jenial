/**
 * /api/nano/shot-variants - Nano Banana Pro Shot Variants endpoint
 * Vercel-compatible handler wrapper
 */
import { handleShotVariants } from './index.js';

export default async function handler(req, res) {
    return handleShotVariants(req, res);
}
