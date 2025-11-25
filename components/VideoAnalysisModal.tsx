/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ImageFile} from '../types';
import {CheckIcon, FilmIcon, XMarkIcon} from './icons';
import {fileToBase64} from './PromptForm';

interface VideoAnalysisModalProps {
  videoFile: File;
  onClose: () => void;
  onConfirm: (context: {
    lastFrame: ImageFile;
    motionDescription: string;
    originalVideo: File;
  }) => void;
}

const VideoAnalysisModal: React.FC<VideoAnalysisModalProps> = ({
  videoFile,
  onClose,
  onConfirm,
}) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<ImageFile | null>(null);
  const [lastFrame, setLastFrame] = useState<ImageFile | null>(null);
  const [motionDescription, setMotionDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);

  const captureFrameAtTime = useCallback(
    (video: HTMLVideoElement, time: number): Promise<ImageFile> => {
      return new Promise((resolve, reject) => {
        // Ensure the video element has the correct CORS policy if needed, although for object URLs it's generally fine.
        video.crossOrigin = 'anonymous';

        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Could not get canvas context');

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            if (blob) {
              const file = new File(
                [blob],
                `frame_at_${time.toFixed(2)}s.png`,
                {type: 'image/png'},
              );
              try {
                const imageFile = await fileToBase64<ImageFile>(file);
                resolve(imageFile);
              } catch (e) {
                reject(e);
              }
            } else {
              reject('Canvas toBlob failed');
            }
          }, 'image/png');
        };

        const onError = (e: Event | string) => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          reject(
            new Error(
              `Video seeking error: ${
                e instanceof Event
                  ? (e.target as HTMLVideoElement).error?.message
                  : e
              }`,
            ),
          );
        };

        video.addEventListener('seeked', onSeeked, {once: true});
        video.addEventListener('error', onError, {once: true});

        // This is the most reliable way to trigger a seek.
        video.currentTime = time;
      });
    },
    [],
  );

  useEffect(() => {
    const src = URL.createObjectURL(videoFile);
    setVideoSrc(src);

    // Use a separate, off-screen video element for frame extraction
    // to not interfere with the user-controlled player.
    const extractionVideo = document.createElement('video');
    extractionVideo.src = src;
    extractionVideo.muted = true;

    extractionVideo.onloadedmetadata = async () => {
      try {
        const duration = extractionVideo.duration;
        // Capture frames sequentially to avoid race conditions.
        const first = await captureFrameAtTime(extractionVideo, 0);
        setFirstFrame(first);
        const last = await captureFrameAtTime(
          extractionVideo,
          Math.max(0, duration - 0.1), // Pull back slightly from the very end.
        );
        setLastFrame(last);
      } catch (error) {
        console.error('Failed to extract frames:', error);
        alert(
          'Could not process video file. It might be corrupt or in an unsupported format.',
        );
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    extractionVideo.onerror = () => {
      console.error('Error loading video for frame extraction.');
      alert(
        'Could not load video file. It might be corrupt or in an unsupported format.',
      );
      setIsLoading(false);
      onClose();
    };

    return () => {
      URL.revokeObjectURL(src);
    };
  }, [videoFile, captureFrameAtTime, onClose]);

  const handleConfirm = () => {
    if (lastFrame && motionDescription.trim()) {
      onConfirm({
        lastFrame,
        motionDescription,
        originalVideo: videoFile,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl p-6 flex flex-col gap-4 max-h-[95vh]">
        <div className="flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FilmIcon className="w-6 h-6 text-indigo-400" />
            Analyse de Continuité
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin mb-4"></div>
            <p>Analyse de la vidéo en cours...</p>
          </div>
        ) : (
          <div className="flex-grow flex flex-col gap-4 overflow-y-auto">
            <div className="w-full aspect-video bg-black rounded-lg">
              {videoSrc && (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="flex flex-col items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-400">
                  Première image
                </h3>
                {firstFrame && (
                  <img
                    src={URL.createObjectURL(firstFrame.file)}
                    alt="Première image"
                    className="rounded-lg border-2 border-gray-600 max-h-40"
                  />
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-400">
                  Dernière image
                </h3>
                {lastFrame && (
                  <img
                    src={URL.createObjectURL(lastFrame.file)}
                    alt="Dernière image"
                    className="rounded-lg border-2 border-indigo-500 max-h-40"
                  />
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="motion-description"
                className="text-sm font-semibold mb-2 text-gray-300 block text-center">
                Décrivez le mouvement principal ou l'action entre ces deux
                images
              </label>
              <input
                id="motion-description"
                type="text"
                value={motionDescription}
                onChange={(e) => setMotionDescription(e.target.value)}
                placeholder="Ex: travelling avant lent, un personnage marche de gauche à droite..."
                className="w-full bg-[#1f1f1f] border border-gray-600 rounded-lg p-3 text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        <div className="flex-shrink-0 flex justify-end gap-4 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!lastFrame || !motionDescription.trim() || isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
            <CheckIcon className="w-5 h-5" />
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalysisModal;
