/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StoryboardPreviewModal - 12 Shot Variants Grid
 * 
 * Displays a grid of 12 camera angle/framing variants generated via Nano API.
 * User can select "Utiliser ce plan" to apply the variant to the current segment.
 */
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Dogma, ImageFile, NanoApplyPayload, STANDARD_SHOT_LIST } from '../types';
import { SparklesIcon, XMarkIcon } from './icons';
import { generateShotVariants } from '../services/nanoService';

interface StoryboardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVariant: (payload: NanoApplyPayload) => void;
  segmentIndex: number;  // 0 = root, 1..N = extensions
  baseImage: ImageFile;
  currentPrompt: string;
  dogma: Dogma | null;
}

interface VariantGridItem {
  shotType: typeof STANDARD_SHOT_LIST[number];
  image: ImageFile | null;
  prompt: string;
  isLoading: boolean;
  error: string | null;
}

const StoryboardPreviewModal: React.FC<StoryboardPreviewModalProps> = ({
  isOpen,
  onClose,
  onApplyVariant,
  segmentIndex,
  baseImage,
  currentPrompt,
  dogma,
}) => {
  const [variants, setVariants] = useState<VariantGridItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Derive target from segment index
  const target = segmentIndex === 0 ? 'root' : 'extension';

  // Initialize grid with empty slots
  useEffect(() => {
    if (isOpen) {
      const initialVariants: VariantGridItem[] = STANDARD_SHOT_LIST.map(shotType => ({
        shotType,
        image: null,
        prompt: '',
        isLoading: false,
        error: null,
      }));
      setVariants(initialVariants);
      setGlobalError(null);
    }
  }, [isOpen]);

  // Generate all variants
  const handleGenerateAll = useCallback(async () => {
    setIsGenerating(true);
    setGlobalError(null);

    // Mark all as loading
    setVariants(prev => prev.map(v => ({ ...v, isLoading: true, error: null })));

    try {
      const results = await generateShotVariants({
        baseImage: baseImage,
        shotList: [...STANDARD_SHOT_LIST],
        dogma: dogma,
      });

      // Update variants with results
      setVariants(prev => prev.map(v => {
        // Find result matching this shot type by label
        const result = results.variants.find(r => r.label === v.shotType);
        if (result) {
          return {
            ...v,
            image: result.previewImage,
            prompt: result.deltaInstruction || currentPrompt,
            isLoading: false,
          };
        }
        return { ...v, isLoading: false, error: 'Not generated' };
      }));
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Failed to generate variants');
      setVariants(prev => prev.map(v => ({ ...v, isLoading: false })));
    } finally {
      setIsGenerating(false);
    }
  }, [currentPrompt, baseImage, dogma]);

  // Apply a variant
  const handleApplyVariant = useCallback((variant: VariantGridItem) => {
    if (!variant.image) return;

    const payload: NanoApplyPayload = {
      target: target as 'root' | 'extension',
      segmentIndex,
      previewPrompt: variant.prompt || currentPrompt,
      previewImage: variant.image,
      cameraNotes: variant.shotType,
    };

    console.log('[StoryboardPreview] Applying variant:', {
      shotType: variant.shotType,
      segmentIndex,
      target,
    });

    onApplyVariant(payload);
    onClose();
  }, [segmentIndex, target, currentPrompt, onApplyVariant, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[90vw] max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-orange-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Couverture de Plans</h2>
              <p className="text-sm text-gray-400">
                {segmentIndex === 0 ? 'Root' : `Extension ${segmentIndex}`} — 12 variantes de cadrage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateAll}
              disabled={isGenerating}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Générer 12 Plans
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {globalError && (
          <div className="mx-4 mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            {globalError}
          </div>
        )}

        {/* Grid */}
        <div className="flex-grow overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-4">
            {variants.map((variant, idx) => (
              <div
                key={variant.shotType}
                className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden group hover:border-orange-500/50 transition-colors"
              >
                {/* Image / Placeholder */}
                <div className="aspect-video relative bg-gray-900">
                  {variant.isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 border-3 border-t-transparent border-orange-500 rounded-full animate-spin" />
                    </div>
                  ) : variant.image ? (
                    <>
                      <img
                        src={`data:image/jpeg;base64,${variant.image.base64}`}
                        alt={variant.shotType}
                        className="w-full h-full object-cover"
                      />
                      {/* Hover Action */}
                      <button
                        onClick={() => handleApplyVariant(variant)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <span className="px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg shadow-lg">
                          Utiliser ce plan
                        </span>
                      </button>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                      Non généré
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-300 truncate">
                    {variant.shotType}
                  </div>
                  {variant.error && (
                    <div className="text-[10px] text-red-400 mt-1">{variant.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-gray-700 text-center text-xs text-gray-500">
          Cliquez sur une vignette pour l'appliquer au segment courant
        </div>
      </div>
    </div>
  );
};

export default StoryboardPreviewModal;