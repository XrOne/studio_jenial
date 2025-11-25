/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  AspectRatio,
  GenerationMode,
  Resolution,
  SavedShot,
  VeoModel,
} from '../types';

// A simple, dark grey placeholder SVG, base64 encoded.
// <svg width="160" height="90" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="90" fill="#2d3748"/></svg>
const placeholderThumbnail =
  'PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiMyZDM3NDgiLz48L3N2Zz4=';

export const defaultShots: SavedShot[] = [
  {
    id: 'default-shot-1',
    title: 'Cyberpunk Alleyway',
    prompt:
      'A rain-slicked alley in a futuristic cyberpunk city. Neon signs reflect in the puddles. A lone figure in a trench coat walks away from the camera. Cinematic style. Camera: smooth dolly out.',
    thumbnail: placeholderThumbnail,
    createdAt: new Date('2024-07-15T10:00:00Z').toISOString(),
    model: VeoModel.VEO_FAST,
    aspectRatio: AspectRatio.LANDSCAPE,
    resolution: Resolution.P720,
    mode: GenerationMode.TEXT_TO_VIDEO,
  },
  {
    id: 'default-shot-2',
    title: 'Enchanted Forest Fly-through',
    prompt:
      'A majestic drone shot flying through a mystical, enchanted forest. Sunbeams pierce through the dense canopy, illuminating glowing mushrooms and ancient, moss-covered trees. Majestic style. Camera: high-angle drone flyover.',
    thumbnail: placeholderThumbnail,
    createdAt: new Date('2024-07-14T14:30:00Z').toISOString(),
    model: VeoModel.VEO,
    aspectRatio: AspectRatio.PORTRAIT,
    resolution: Resolution.P1080,
    mode: GenerationMode.TEXT_TO_VIDEO,
  },
  {
    id: 'default-shot-3',
    title: 'High-Speed Desert Chase',
    prompt:
      'A futuristic vehicle speeding across a vast desert landscape at sunset. Dust and sand are kicked up by the wheels, catching the golden light. Action-packed, cinematic style. Camera: fast, low-angle tracking shot.',
    thumbnail: placeholderThumbnail,
    createdAt: new Date('2024-07-13T18:45:00Z').toISOString(),
    model: VeoModel.VEO_FAST,
    aspectRatio: AspectRatio.LANDSCAPE,
    resolution: Resolution.P720,
    mode: GenerationMode.TEXT_TO_VIDEO,
  },
];
