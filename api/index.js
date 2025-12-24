/**
 * Vercel Serverless Entry Point
 * 
 * This file exports the Express app as a Vercel serverless function.
 * The app handles its own routing internally.
 */
import app from '../server.js';

// Export as a function that handles (req, res)
export default function handler(req, res) {
    return app(req, res);
}