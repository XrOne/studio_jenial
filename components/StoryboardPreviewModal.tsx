/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StoryboardPreviewModal - 12 Shot Variants Grid
 * 
 * Displays a grid of 12 camera angle/framing variants generated via Nano API.
 * Supports two modes:
 * - single-select: Click to apply one variant immediately
 * - ordered-select: Click to build ordered shot list with durations
 */
import * as React from 'react';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Dogma, ImageFile, NanoApplyPayload, STANDARD_SHOT_LIST } from '../types';
import { SparklesIcon, XMarkIcon, FilmIcon } from './icons';
import { generateShotVariants } from '../services/nanoService';

// === TYPES ===

export interface OrderedShot {
  shotType: string;
  image: ImageFile;
  prompt: string;
  duration: number;  // seconds
  order: number;     // 1-based order
}

interface StoryboardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVariant: (payload: NanoApplyPayload) => void;
  segmentIndex: number;  // 0 = root, 1..N = extensions
  baseImage: ImageFile;
  currentPrompt: string;
  dogma: Dogma | null;
  // === MODE SELECTION ===
  mode?: 'single-select' | 'ordered-select';
  onBuildTimeline?: (shots: OrderedShot[]) => void;
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
  mode = 'single-select',
  onBuildTimeline,
}) => {
  const [variants, setVariants] = useState<VariantGridItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // === ORDERED-SELECT STATE ===
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);  // Array of shotTypes in selection order
  const [durations, setDurations] = useState<Record<string, number>>({});  // shotType -> duration in seconds

  // Derive target from segment index
  const target = segmentIndex === 0 ? 'root' : 'extension';

  // Calculate cumulative timecodes
  const timecodes = useMemo(() => {
    const result: Record<string, string> = {};
    let cumulative = 0;
    for (const shotType of selectedOrder) {
      const mins = Math.floor(cumulative / 60);
      const secs = cumulative % 60;
      result[shotType] = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      cumulative += durations[shotType] || 3;  // Default 3s per shot
    }
    return result;
  }, [selectedOrder, durations]);

  // Total duration
  const totalDuration = useMemo(() => {
    return selectedOrder.reduce((sum, shotType) => sum + (durations[shotType] || 3), 0);
  }, [selectedOrder, durations]);

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
      setSelectedOrder([]);
      setDurations({});
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
        quality: 'fast',
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

  // Handle variant click based on mode
  const handleVariantClick = useCallback((variant: VariantGridItem) => {
    if (!variant.image) return;

    if (mode === 'single-select') {
      // Immediate apply
      const payload: NanoApplyPayload = {
        target: target as 'root' | 'extension',
        segmentIndex,
        previewPrompt: variant.prompt || currentPrompt,
        previewImage: variant.image,
        cameraNotes: variant.shotType,
      };
      console.log('[StoryboardPreview] Applying variant:', { shotType: variant.shotType, segmentIndex, target });
      onApplyVariant(payload);
      onClose();
    } else {
      // Ordered-select: toggle in selection order
      setSelectedOrder(prev => {
        if (prev.includes(variant.shotType)) {
          // Remove from selection
          return prev.filter(s => s !== variant.shotType);
        } else {
          // Add to selection
          return [...prev, variant.shotType];
        }
      });
      // Initialize duration if not set
      if (!durations[variant.shotType]) {
        setDurations(prev => ({ ...prev, [variant.shotType]: 3 }));  // Default 3s
      }
    }
  }, [mode, target, segmentIndex, currentPrompt, onApplyVariant, onClose, durations]);

  // Build timeline from ordered shots
  const handleBuildTimeline = useCallback(() => {
    if (!onBuildTimeline || selectedOrder.length === 0) return;

    const orderedShots: OrderedShot[] = selectedOrder.map((shotType, idx) => {
      const variant = variants.find(v => v.shotType === shotType);
      return {
        shotType,
        image: variant?.image || baseImage,
        prompt: variant?.prompt || currentPrompt,
        duration: durations[shotType] || 3,
        order: idx + 1,
      };
    });

    console.log('[StoryboardPreview] Building timeline:', { shotCount: orderedShots.length, totalDuration });
    onBuildTimeline(orderedShots);
    onClose();
  }, [selectedOrder, variants, baseImage, currentPrompt, durations, totalDuration, onBuildTimeline, onClose]);

  // Get order badge for a shot type
  const getOrderBadge = (shotType: string): number | null => {
    const idx = selectedOrder.indexOf(shotType);
    return idx >= 0 ? idx + 1 : null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[90vw] max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-orange-400" />
            <div>
              <h2 className="text-xl font-bold text-white">
                {mode === 'ordered-select' ? 'Mode Découpage' : 'Couverture de Plans'}
              </h2>
              <p className="text-sm text-gray-400">
                {mode === 'ordered-select'
                  ? `Cliquez pour ordonner • ${selectedOrder.length} plans sélectionnés`
                  : `${segmentIndex === 0 ? 'Root' : `Extension ${segmentIndex}`} — 12 variantes de cadrage`
                }
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
            {variants.map((variant) => {
              const orderBadge = getOrderBadge(variant.shotType);
              const isSelected = orderBadge !== null;

              return (
                <div
                  key={variant.shotType}
                  className={`bg-gray-800 rounded-xl border overflow-hidden group transition-all cursor-pointer
                    ${isSelected
                      ? 'border-green-500 ring-2 ring-green-500/30'
                      : 'border-gray-700 hover:border-orange-500/50'
                    }`}
                  onClick={() => handleVariantClick(variant)}
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
                        {/* Order Badge (ordered-select mode) */}
                        {mode === 'ordered-select' && isSelected && (
                          <div className="absolute top-2 left-2 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                            {orderBadge}
                          </div>
                        )}
                        {/* Single-select hover action */}
                        {mode === 'single-select' && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg shadow-lg">
                              Utiliser ce plan
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                        Non généré
                      </div>
                    )}
                  </div>

                  {/* Label + Duration Input */}
                  <div className="p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-gray-300 truncate">
                        {variant.shotType}
                      </div>
                      {/* Duration input (ordered-select mode, when selected) */}
                      {mode === 'ordered-select' && isSelected && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={durations[variant.shotType] || 3}
                            onChange={(e) => {
                              e.stopPropagation();
                              setDurations(prev => ({
                                ...prev,
                                [variant.shotType]: Math.max(1, Math.min(30, parseInt(e.target.value) || 3)),
                              }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-12 px-1 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded text-white text-center"
                          />
                          <span className="text-[10px] text-gray-500">s</span>
                        </div>
                      )}
                    </div>
                    {/* Timecode (ordered-select mode) */}
                    {mode === 'ordered-select' && isSelected && (
                      <div className="text-[10px] text-green-400 mt-1">
                        @ {timecodes[variant.shotType]}
                      </div>
                    )}
                    {variant.error && (
                      <div className="text-[10px] text-red-400 mt-1">{variant.error}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          {mode === 'ordered-select' ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <span className="font-bold text-white">{selectedOrder.length}</span> plans •{' '}
                <span className="font-bold text-green-400">{totalDuration}s</span> total
              </div>
              <button
                onClick={handleBuildTimeline}
                disabled={selectedOrder.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FilmIcon className="w-4 h-4" />
                Construire la Timeline
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500">
              Cliquez sur une vignette pour l'appliquer au segment courant
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryboardPreviewModal;