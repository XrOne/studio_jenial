/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ImageFile} from '../types';
import {
  CheckIcon,
  ScissorsIcon,
  UploadCloudIcon,
  VideoIcon,
  XMarkIcon,
} from './icons';
import {fileToBase64} from './PromptForm';

interface VideoFrameSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (imageFile: ImageFile) => void;
}

const VideoFrameSelectorModal: React.FC<VideoFrameSelectorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<{
    dataUrl: string;
    blob: Blob;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      if (capturedFrame) {
        URL.revokeObjectURL(capturedFrame.dataUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc, capturedFrame?.dataUrl]);

  const resetState = useCallback(() => {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    if (capturedFrame) URL.revokeObjectURL(capturedFrame.dataUrl);
    setVideoSrc(null);
    setVideoFile(null);
    setCapturedFrame(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [videoSrc, capturedFrame]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      resetState(); // Reset previous state before loading new video
      setVideoFile(file);
      setVideoSrc(URL.createObjectURL(file));
    }
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          if (capturedFrame?.dataUrl) {
            URL.revokeObjectURL(capturedFrame.dataUrl);
          }
          setCapturedFrame({
            dataUrl: URL.createObjectURL(blob),
            blob,
          });
        }
      },
      'image/png',
      1.0,
    );
  };

  const handleConfirm = async () => {
    if (capturedFrame && videoFile) {
      const originalName = videoFile.name.split('.').slice(0, -1).join('.');
      const file = new File([capturedFrame.blob], `${originalName}_frame.png`, {
        type: 'image/png',
      });
      try {
        const imageFile = await fileToBase64<ImageFile>(file);
        onConfirm(imageFile);
        handleClose();
      } catch (error) {
        console.error('Error processing captured frame:', error);
        alert('Failed to process frame.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <VideoIcon className="w-6 h-6 text-indigo-400" />
            Video Frame Selector
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
          {/* Video Player Section */}
          <div className="bg-black rounded-lg flex items-center justify-center p-2">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="max-w-full max-h-[400px] rounded"
              />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-600 rounded-lg hover:bg-gray-700/50 hover:text-white transition-colors">
                <UploadCloudIcon className="w-12 h-12 mb-2" />
                <span className="font-semibold">Upload a video</span>
                <span className="text-sm">Click here to select a file</span>
              </button>
            )}
          </div>

          {/* Capture Preview Section */}
          <div className="flex flex-col gap-4">
            <div className="bg-black rounded-lg flex-grow flex items-center justify-center p-2">
              {capturedFrame ? (
                <img
                  src={capturedFrame.dataUrl}
                  alt="Captured frame"
                  className="max-w-full max-h-[350px] rounded"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <p>Captured frame will appear here.</p>
                  <p className="text-sm">
                    Use the player controls to find the perfect moment.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleCaptureFrame}
              disabled={!videoSrc}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
              <ScissorsIcon className="w-5 h-5" />
              Capture Current Frame
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
          />
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!capturedFrame}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
            <CheckIcon className="w-5 h-5" />
            Confirm Frame
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoFrameSelectorModal;