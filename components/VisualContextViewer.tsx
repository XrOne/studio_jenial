/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { AppStage, ImageFile } from '../types';
import { PencilIcon } from './icons';

interface VisualContextViewerProps {
  image: ImageFile;
  stage: AppStage;
  onEditRequest: (image: ImageFile) => void;
  onApplyNano?: (image: ImageFile) => void;
}

const VisualContextViewer: React.FC<VisualContextViewerProps> = ({ image, stage, onEditRequest, onApplyNano }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <h2 className="text-xl font-semibold text-gray-300 mb-4 flex-shrink-0">
        {stage}
      </h2>
      <div className="flex-grow w-full flex items-center justify-center min-h-0 relative group">
        <img
          src={URL.createObjectURL(image.file)}
          alt="Visual Context"
          className="max-w-full max-h-full object-contain rounded-md shadow-2xl"
        />
        <button
          onClick={() => onEditRequest(image)}
          className="absolute top-4 right-4 p-3 bg-black/60 hover:bg-indigo-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-300"
          title="Edit with AI"
        >
          <PencilIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default VisualContextViewer;
