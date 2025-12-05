/**
 * Vertex AI Provider for Veo Video Generation
 * 
 * Implements video generation using Google Cloud Vertex AI.
 * Uses BYOK (Bring Your Own Key) pattern where credentials are passed per request.
 */

import { helpers } from '@google-cloud/aiplatform';

export const generateVideoVertex = async (
    vertexConfig,
    params
) => {
    const { projectId, location, accessToken } = vertexConfig;
    const endpoint = `https://${location}-aiplatform.googleapis.com`;

    // We use manual fetch for BYOK to easily pass the access token
    // without complex GoogleAuth client setup.

    const publisher = 'google';
    const model = params.model || 'veo-2.0-generate-preview'; // Default to a Veo model
    const endpointPath = `projects/${projectId}/locations/${location}/publishers/${publisher}/models/${model}`;

    // Construct the instance
    const instance = {
        prompt: params.prompt,
    };

    // Construct parameters
    const parameters = {
        sampleCount: 1,
        ...params.config
    };

    const instanceValue = helpers.toValue(instance);
    const parametersValue = helpers.toValue(parameters);

    // Predict (Long Running)
    // Veo models typically require predictLongRunning

    try {
        const fetch = (await import('node-fetch')).default || global.fetch;

        const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/${endpointPath}:predictLongRunning`;

        // Note: If using native fetch, headers and body are standard. 
        // If using node-fetch, ensure the import logic above works or rely on global fetch in Node 18+

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [instance],
                parameters: parameters
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vertex API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        // Check if operation is done (unlikely for video) or return operation name
        // The prompt says "poll operations.get".

        // We will poll here.
        let operation = data;
        const operationName = operation.name;

        console.log(`[Vertex] Operation started: ${operationName}`);

        // Poll loop
        while (!operation.done) {
            // Wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));

            const pollUrl = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;
            const pollResponse = await fetch(pollUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!pollResponse.ok) {
                throw new Error(`Polling Error: ${pollResponse.statusText}`);
            }

            operation = await pollResponse.json();
            console.log(`[Vertex] Polling... Done: ${operation.done}`);
        }

        // Operation done. Extract video.
        // Vertex Veo usually returns a GCS URI or base64.
        if (operation.response) {
            // The response structure depends on the model.
            // We will return the raw operation response and let the frontend service handle the specific parsing
            return operation.response;
        } else if (operation.error) {
            throw new Error(`Vertex Operation Failed: ${JSON.stringify(operation.error)}`);
        }

        return operation;

    } catch (error) {
        console.error('[VertexProvider] Error:', error);
        throw error;
    }
};
