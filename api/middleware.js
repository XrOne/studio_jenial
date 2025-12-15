import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req, res, next) => {
    req.id = uuidv4();
    // Log request start
    const provider = req.body?.provider || 'unknown';
    const quality = req.body?.quality || 'unknown';
    console.log(`[${req.id}] ${req.method} ${req.url} provider=${provider} quality=${quality}`);
    next();
};

export const errorHandlerMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const requestId = req.id || 'unknown';

    console.error(`[${requestId}] Error:`, err);

    res.status(statusCode).json({
        error: {
            message: err.message || 'Internal Server Error',
            code: err.code || 'INTERNAL_ERROR',
            requestId,
            provider: req.body?.provider,
            details: err.details || undefined
        }
    });
};
