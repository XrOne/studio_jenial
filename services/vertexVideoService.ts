/**
 * Vertex AI Video Service
 * 
 * Handles client-side interaction with the Vertex AI backend route.
 */

import { VeoModel } from '../types';

export interface VertexVideoConfig {
  projectId: string;
  location: string;
  accessToken: string;
}

export const generateVideoVertex = async (
  config: VertexVideoConfig,
  params: {
    model: string;
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
  }
) => {
  const response = await fetch('/api/video/vertex/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: config.projectId,
      location: config.location,
      accessToken: config.accessToken,
      model: params.model,
      prompt: params.prompt,
      config: {
        aspectRatio: params.aspectRatio,
        resolution: params.resolution
      }
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Vertex API Request Failed: ${response.status}`);
  }

  return response.json();
};
