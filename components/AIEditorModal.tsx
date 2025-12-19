/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { useState } from 'react';
import { editImage } from '../services/geminiService';
import { Dogma, ImageFile, NanoApplyPayload } from '../types';
import AngleKit from './AngleKit';
import {
  PencilIcon,
  XMarkIcon,
  ChevronDownIcon,
  SparklesIcon,
  HighAngleIcon,
  LowAngleIcon,
  PanLeftIcon,
  PanRightIcon,
  ZoomInIcon
} from './icons';
import { ImageUpload } from './PromptForm';

interface AIEditorModalProps {
  image: ImageFile;
  onClose: () => void;
  onConfirm: (newImage: ImageFile) => void;
  dogma: Dogma | null;
  // === NANO BANANA PRO: Stylet alignment props ===
  onApply?: (payload: NanoApplyPayload) => void;  // For returning prompt + image + meta
  segmentIndex?: number | null;  // null=character, 0=root, 1..N=extension
  target?: 'root' | 'extension' | 'character';  // Derived from segmentIndex
  initialPrompt?: string;  // Pre-fill instruction for alignment mode
}

const AIEditorModal: React.FC<AIEditorModalProps> = ({
  image,
  onClose,
  onConfirm,
  dogma,
  onApply,
  segmentIndex = null,
  target = 'character',
  initialPrompt = '',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [styleImage, setStyleImage] = useState<ImageFile | null>(null);
  const [editedImage, setEditedImage] = useState<ImageFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraNotes, setCameraNotes] = useState<string>('');
  const [movementNotes, setMovementNotes] = useState<string>('');

  const [model, setModel] = useState<'nano' | 'nano-pro'>('nano');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [showAxisControls, setShowAxisControls] = useState(true);

  // Detect if we're in alignment mode (for stylet)
  const isAlignmentMode = !!onApply;

  const handleEdit = async (overridePrompt?: string) => {
    const finalPromptText = overridePrompt || prompt;

    if (!finalPromptText.trim()) {
      setError('Please provide an editing instruction.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const imagesToProcess = [image];
      let fullPrompt = finalPromptText;

      if (styleImage) {
        imagesToProcess.push(styleImage);
        fullPrompt = `${finalPromptText}. Apply the style from @image2 to the edit on @image1.`;
      }

      const modelId = model === 'nano' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
      const result = await editImage(imagesToProcess, fullPrompt, dogma, modelId);
      setEditedImage(result);

      // Auto-derive camera/movement notes from prompt for alignment mode
      if (isAlignmentMode) {
        // Extract camera notes from prompt
        const cameraMatch = finalPromptText.match(/(?:camera|angle|shot|plan)[:]*\s*([^.]+)/i);
        if (cameraMatch) setCameraNotes(cameraMatch[1].trim());

        const movementMatch = finalPromptText.match(/(?:movement|motion|dolly|pan|zoom)[:]*\s*([^.]+)/i);
        if (movementMatch) setMovementNotes(movementMatch[1].trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit image.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAxis = (axis: string, instruction: string) => {
    // Force Pro model for complex spatial transformations
    setModel('nano-pro');
    const axisPrompt = `Change camera angle to ${axis}. ${instruction}. Maintain absolute character and style consistency with the original image.`;
    setPrompt(axisPrompt); // Update UI so user sees what happened
    handleEdit(axisPrompt);
  };

  const handleSelectAngle = (angle: string) => {
    setPrompt(prev => `${prev} ${angle} shot`.trim());
  };

  const handleConfirm = () => {
    if (editedImage) {
      onConfirm(editedImage);
    } else {
      onConfirm(image);
    }
  };

  // === NANO BANANA PRO: Apply prompt for stylet alignment ===
  const handleApplyPrompt = () => {
    if (!onApply) return;

    const payload: NanoApplyPayload = {
      target,
      segmentIndex,
      previewPrompt: prompt,
      previewImage: editedImage || image,
      cameraNotes: cameraNotes || undefined,
      movementNotes: movementNotes || undefined,
    };

    console.log('[AIEditorModal] Applying prompt with Nano payload:', {
      target: payload.target,
      segmentIndex: payload.segmentIndex,
      promptLength: payload.previewPrompt.length,
    });

    onApply(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-5xl flex flex-col gap-4 h-[90vh] relative overflow-hidden">

        {/* Top "Window" / Model Selector Area */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-900/80 to-transparent pointer-events-none z-10" />

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900/90 backdrop-blur-md border border-gray-600 rounded-full text-sm font-medium text-white hover:border-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/20"
            >
              <span className={`flex items-center gap-2 ${model === 'nano' ? 'text-indigo-400' : 'text-purple-400'}`}>
                {model === 'nano' ? (
                  <>⚡ Gemini Flash</>
                ) : (
                  <><SparklesIcon className="w-3.5 h-3.5" /> Gemini 3 Pro</>
                )}
              </span>
              <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col z-30 animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => { setModel('nano'); setIsModelDropdownOpen(false); }}
                  className="px-4 py-3 text-left text-sm hover:bg-gray-800 text-gray-300 hover:text-white flex items-center gap-3 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${model === 'nano' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-gray-600'}`} />
                  <div>
                    <span className="block font-medium">Gemini 2.5 Flash</span>
                    <span className="text-xs text-gray-500">Fast & Efficient</span>
                  </div>
                </button>
                <div className="h-px bg-gray-800 w-full" />
                <button
                  onClick={() => { setModel('nano-pro'); setIsModelDropdownOpen(false); }}
                  className="px-4 py-3 text-left text-sm hover:bg-gray-800 text-gray-300 hover:text-white flex items-center gap-3 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${model === 'nano-pro' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'bg-gray-600'}`} />
                  <div>
                    <span className="block font-medium">Gemini 3.0 Pro</span>
                    <span className="text-xs text-gray-500">Highest Quality & Logic</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4 h-full pt-20"> {/* Increased top padding to push header down */}
          <div className="flex justify-between items-center flex-shrink-0">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <PencilIcon className="w-6 h-6 text-indigo-400" />
              AI Editor
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAxisControls(!showAxisControls)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${showAxisControls ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                Banana Axis 3D
              </button>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-grow flex gap-6 overflow-hidden">
            {/* Image Preview & Axis Overlay */}
            <div className="w-2/3 relative bg-black rounded-lg border border-gray-700/30 overflow-hidden group">
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={URL.createObjectURL(editedImage?.file ?? image.file)}
                  alt="Image to edit"
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Banana Axis Overlay */}
              {showAxisControls && !isLoading && (
                <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {/* Top: High Angle */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleQuickAxis('High Angle', 'Look down from above')}
                      className="pointer-events-auto p-3 bg-black/50 hover:bg-indigo-600 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-indigo-400 transition-all transform hover:scale-110 hover:-translate-y-1 shadow-lg"
                      title="High Angle (Plongée)"
                    >
                      <HighAngleIcon className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center w-full px-4">
                    {/* Left: Pan/Profile Left */}
                    <button
                      onClick={() => handleQuickAxis('Left Side Profile', 'Rotate camera left around subject')}
                      className="pointer-events-auto p-3 bg-black/50 hover:bg-indigo-600 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-indigo-400 transition-all transform hover:scale-110 hover:-translate-x-1 shadow-lg"
                      title="Left Profile"
                    >
                      <PanLeftIcon className="w-6 h-6" />
                    </button>

                    {/* Center: Zoom/Detail */}
                    <button
                      onClick={() => handleQuickAxis('Extreme Close Up', 'Zoom in on the face/details')}
                      className="pointer-events-auto p-4 bg-indigo-600/20 hover:bg-indigo-600 backdrop-blur-sm rounded-full text-indigo-300 hover:text-white border border-indigo-500/30 transition-all transform hover:scale-110 shadow-lg"
                      title="Zoom In / Enhance Detail"
                    >
                      <ZoomInIcon className="w-6 h-6" />
                    </button>

                    {/* Right: Pan/Profile Right */}
                    <button
                      onClick={() => handleQuickAxis('Right Side Profile', 'Rotate camera right around subject')}
                      className="pointer-events-auto p-3 bg-black/50 hover:bg-indigo-600 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-indigo-400 transition-all transform hover:scale-110 hover:translate-x-1 shadow-lg"
                      title="Right Profile"
                    >
                      <PanRightIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Bottom: Low Angle */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleQuickAxis('Low Angle', 'Look up from below')}
                      className="pointer-events-auto p-3 bg-black/50 hover:bg-indigo-600 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-indigo-400 transition-all transform hover:scale-110 hover:translate-y-1 shadow-lg"
                      title="Low Angle (Contre-plongée)"
                    >
                      <LowAngleIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm z-20">
                  <div className="w-12 h-12 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-white font-semibold animate-pulse">
                    {model === 'nano' ? 'Flash Edit in progress...' : 'Pro 3.0 Axis Shift...'}
                  </p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="w-1/3 flex flex-col gap-4">
              <div>
                <label htmlFor="ai-prompt" className="text-sm font-semibold mb-2 text-gray-400 block">
                  Editing Instruction
                </label>
                <div className="flex items-center gap-2 bg-[#1f1f1f] border border-gray-600 rounded-lg p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
                  <textarea
                    id="ai-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., add a futuristic motorcycle, make it night..."
                    className="w-full h-24 bg-transparent focus:outline-none text-base text-gray-200 placeholder-gray-500 px-2 resize-none"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <AngleKit onSelectAngle={handleSelectAngle} />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 text-gray-400 block">
                  Style Reference (optional)
                </label>
                <ImageUpload
                  label="Add Style"
                  image={styleImage}
                  onSelect={setStyleImage}
                  onRemove={() => setStyleImage(null)}
                  className="w-full h-24"
                />
              </div>

              {error && <p className="text-sm text-red-400 text-center bg-red-900/20 p-2 rounded border border-red-800">{error}</p>}

              <div className="mt-auto">
                <button
                  onClick={async () => {
                    // Generate, then auto-apply
                    await handleEdit();
                    // Auto-apply after generation completes
                    if (isAlignmentMode) {
                      handleApplyPrompt();
                    } else {
                      handleConfirm();
                    }
                  }}
                  disabled={isLoading || !prompt.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:bg-gray-600 disabled:cursor-wait ${model === 'nano-pro'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}>
                  {isLoading && <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>}
                  <span className="font-semibold">
                    {isLoading ? 'Génération...' : 'Générer & Appliquer'}
                  </span>
                  {!isLoading && model === 'nano-pro' && <SparklesIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-4 flex-shrink-0 pt-4 border-t border-gray-700">
            <button onClick={onClose} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIEditorModal;