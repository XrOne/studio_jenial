/**
 * ModeSelectionStep - Choice between Plan-séquence and Découpage
 * 
 * Displayed after initial keyframe is generated.
 * User chooses workflow mode:
 * - Plan-séquence: Extensions flow (A)
 * - Découpage: 12 vignettes with ordering (B)
 */
import * as React from 'react';
import { ImageFile } from '../types';
import { FilmIcon, ViewColumnsIcon } from './icons';

interface ModeSelectionStepProps {
    keyframeImage: ImageFile;
    onSelectPlanSequence: () => void;
    onSelectDecoupage: () => void;
    isGenerating?: boolean;
}

const ModeSelectionStep: React.FC<ModeSelectionStepProps> = ({
    keyframeImage,
    onSelectPlanSequence,
    onSelectDecoupage,
    isGenerating = false,
}) => {
    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6">
            {/* Header */}
            <div className="text-center">
                <h3 className="text-lg font-bold text-white mb-1">
                    🎬 Keyframe validée
                </h3>
                <p className="text-sm text-gray-400">
                    Choisissez votre mode de travail
                </p>
            </div>

            {/* Keyframe Preview */}
            <div className="flex justify-center">
                <div className="relative w-48 aspect-video rounded-lg overflow-hidden border-2 border-orange-500/50 shadow-lg">
                    <img
                        src={`data:image/jpeg;base64,${keyframeImage.base64}`}
                        alt="Keyframe"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded">
                        ROOT
                    </div>
                </div>
            </div>

            {/* Mode Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Plan-séquence */}
                <button
                    onClick={onSelectPlanSequence}
                    disabled={isGenerating}
                    className="group relative bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/50 hover:border-blue-400 rounded-xl p-4 text-left transition-all hover:shadow-lg hover:shadow-blue-500/10 disabled:opacity-50"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <FilmIcon className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white group-hover:text-blue-300 transition-colors">
                                A) Plan-séquence
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">
                                Générer des extensions vidéo en continuité. Idéal pour un plan continu et fluide.
                            </p>
                        </div>
                    </div>
                    <div className="absolute bottom-2 right-2 text-xs text-blue-400/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        Extensions →
                    </div>
                </button>

                {/* Découpage */}
                <button
                    onClick={onSelectDecoupage}
                    disabled={isGenerating}
                    className="group relative bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/50 hover:border-orange-400 rounded-xl p-4 text-left transition-all hover:shadow-lg hover:shadow-orange-500/10 disabled:opacity-50"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <ViewColumnsIcon className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white group-hover:text-orange-300 transition-colors">
                                B) Découpage
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">
                                12 vignettes à ordonner. Définir durées et timecodes pour un montage structuré.
                            </p>
                        </div>
                    </div>
                    <div className="absolute bottom-2 right-2 text-xs text-orange-400/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        12 Plans →
                    </div>
                </button>
            </div>

            {/* Hint */}
            <p className="text-center text-xs text-gray-500">
                Vous pourrez changer de mode plus tard en régénérant depuis la keyframe.
            </p>
        </div>
    );
};

export default ModeSelectionStep;
