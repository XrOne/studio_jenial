/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
// FIX: Import 'GenerateVideoParams' type to resolve TypeScript error.
import {
  ComplianceResult,
  Dogma,
  GenerateVideoParams,
  ImageFile,
  SequenceProgress,
  VideoFile,
} from '../types';
import {
  ArrowPathIcon,
  BookmarkPlusIcon,
  CheckIcon,
  ChevronsRightIcon,
  DownloadIcon,
  FilmIcon,
  PlusIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from './icons';
import KeyframeRefinementAssistant from './KeyframeRefinementAssistant';
import { analyzeVideoCompliance } from '../services/geminiService';
import { isDriveEnabled, isDriveConnected, connectDrive, uploadToDrive } from '../services/googleDriveClient';

interface VideoResultProps {
  videoUrl: string;
  lastConfig: GenerateVideoParams | null;
  onRetry: () => void;
  onStartNewProject: () => void;
  onExtendVideo: () => void;
  canExtend: boolean;
  onContinueFromFrame: (frame: ImageFile) => void;
  onEditCapturedFrame: (frame: ImageFile) => void;
  sequenceProgress: SequenceProgress | null;
  onSaveShot: (thumbnailBase64: string) => void;
  onContinueSequence: () => void;
  originalVideoForExtension?: VideoFile | null;
  onStartExtensionAssistant: (lastFrame: ImageFile) => void;
  activeDogma: Dogma | null;
  onPromptRevised: (newPrompt: string) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error('Failed to read file as base64.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const VideoResult: React.FC<VideoResultProps> = ({
  videoUrl,
  lastConfig,
  onRetry,
  onStartNewProject,
  onExtendVideo,
  canExtend,
  onContinueFromFrame,
  onEditCapturedFrame,
  sequenceProgress,
  onSaveShot,
  onContinueSequence,
  originalVideoForExtension,
  onStartExtensionAssistant,
  activeDogma,
  onPromptRevised,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [keyframes, setKeyframes] = useState<ImageFile[]>([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [combinedVideoForDownload, setCombinedVideoForDownload] =
    useState<Blob | null>(null);
  const [isPreparingVideo, setIsPreparingVideo] = useState(false);

  // Critic Agent State
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [isAnalyzingCompliance, setIsAnalyzingCompliance] = useState(false);
  const [showComplianceDetails, setShowComplianceDetails] = useState(false);

  // Google Drive State
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState(false);

  // Check Drive status on mount
  useEffect(() => {
    const checkDrive = async () => {
      const enabled = await isDriveEnabled();
      setDriveEnabled(enabled);
      if (enabled) {
        const connected = await isDriveConnected();
        setDriveConnected(connected);
      }
    };
    checkDrive();
  }, []);

  const captureFrameAtTime = useCallback(
    (video: HTMLVideoElement, time: number): Promise<ImageFile> => {
      return new Promise((resolve, reject) => {
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
              const file = new File([blob], `frame_at_${time.toFixed(2)}s.png`, {
                type: 'image/png',
              });
              const base64 = await fileToBase64(file);
              resolve({ file, base64 });
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
              `Video seeking error: ${e instanceof Event
                ? (e.target as HTMLVideoElement).error?.message
                : e
              }`,
            ),
          );
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = time;
      });
    },
    [],
  );

  // Run Critic Agent when keyframes are ready
  useEffect(() => {
    if (keyframes.length > 0 && !complianceResult && !isAnalyzingCompliance && lastConfig) {
      const runCritic = async () => {
        setIsAnalyzingCompliance(true);
        try {
          // Use the middle frame for critique
          const frameToAnalyze = keyframes[Math.floor(keyframes.length / 2)];
          const result = await analyzeVideoCompliance(
            frameToAnalyze.base64,
            lastConfig.prompt,
            activeDogma
          );
          setComplianceResult(result);
        } catch (e) {
          console.error("Critic Agent failed:", e);
        } finally {
          setIsAnalyzingCompliance(false);
        }
      };
      runCritic();
    }
  }, [keyframes, complianceResult, isAnalyzingCompliance, lastConfig, activeDogma]);


  // Main effect to handle setting the video source (single or combined via MediaSource)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let activeUrl: string | null = null;
    setKeyframes([]); // Reset for new video
    setComplianceResult(null); // Reset critic

    if (originalVideoForExtension && videoUrl) {
      setIsPreparingVideo(true);

      const getDuration = (blob: Blob): Promise<number> => {
        return new Promise((resolve, reject) => {
          const tempVideo = document.createElement('video');
          tempVideo.preload = 'metadata';
          const url = URL.createObjectURL(blob);
          tempVideo.src = url;
          tempVideo.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(tempVideo.duration);
          };
          tempVideo.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject('Could not load video metadata to get duration.');
          };
        });
      };

      const setupMediaSource = async () => {
        const originalBlob = originalVideoForExtension.file;
        const extensionBlob = await fetch(videoUrl).then((r) => r.blob());

        setCombinedVideoForDownload(
          new Blob([originalBlob, extensionBlob], { type: originalBlob.type }),
        );

        const originalDuration = await getDuration(originalBlob);

        const mediaSource = new MediaSource();
        activeUrl = URL.createObjectURL(mediaSource);
        video.src = activeUrl;

        mediaSource.addEventListener(
          'sourceopen',
          async () => {
            try {
              const mime = originalBlob.type;
              if (!MediaSource.isTypeSupported(mime)) {
                throw new Error(`Unsupported MIME type for MediaSource: ${mime}`);
              }
              const sourceBuffer = mediaSource.addSourceBuffer(mime);

              const append = (buffer: ArrayBuffer): Promise<void> => {
                return new Promise((resolve, reject) => {
                  const onUpdateEnd = () => {
                    sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                    sourceBuffer.removeEventListener('error', onError);
                    resolve();
                  };
                  const onError = (ev: Event) => {
                    sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                    sourceBuffer.removeEventListener('error', onError);
                    reject(ev);
                  };

                  sourceBuffer.addEventListener('updateend', onUpdateEnd);
                  sourceBuffer.addEventListener('error', onError);
                  try {
                    sourceBuffer.appendBuffer(buffer);
                  } catch (e) {
                    reject(e);
                  }
                });
              };

              const originalBuffer = await originalBlob.arrayBuffer();
              await append(originalBuffer);

              sourceBuffer.timestampOffset = originalDuration;

              const extensionBuffer = await extensionBlob.arrayBuffer();
              await append(extensionBuffer);

              if (mediaSource.readyState === 'open') {
                mediaSource.endOfStream();
              }
            } catch (error) {
              console.error('Failed to append buffers:', error);
              if (mediaSource.readyState === 'open') {
                try {
                  mediaSource.endOfStream();
                } catch (e) {
                  console.error('Failed to end stream on error:', e);
                }
              }
            }
          },
          { once: true },
        );

        mediaSource.addEventListener('sourceended', () =>
          setIsPreparingVideo(false),
        );
        mediaSource.addEventListener('sourceclose', () =>
          setIsPreparingVideo(false),
        );
      };

      setupMediaSource().catch((error) => {
        console.error('Stitching failed:', error);
        setIsPreparingVideo(false);
        if (video) video.src = videoUrl; // fallback
      });
    } else {
      // Single video
      setIsPreparingVideo(false);
      setCombinedVideoForDownload(null);
      activeUrl = videoUrl;
      video.src = activeUrl;
    }

    return () => {
      if (activeUrl && activeUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [videoUrl, originalVideoForExtension]);

  // Effect for extracting keyframes when video data is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isPreparingVideo) return;

    const extract = async () => {
      if (isExtractingFrames || video.readyState < 2) return; // HAVE_CURRENT_DATA

      setIsExtractingFrames(true);
      setKeyframes([]);

      try {
        const duration = video.duration;
        if (duration <= 0 || !isFinite(duration)) {
          console.warn(
            'Cannot extract frames, video duration is invalid:',
            duration,
          );
          setIsExtractingFrames(false);
          return;
        }
        const frameCount = 5;
        const extracted: ImageFile[] = [];
        const timestamps: number[] = [];

        if (duration > 0.1) {
          // Ensure we don't seek to the exact end, which can be problematic
          const effectiveDuration = Math.max(0, duration - 0.1);
          for (let i = 0; i < frameCount; i++) {
            const time = (i / (frameCount - 1)) * effectiveDuration;
            timestamps.push(time);
          }
        }

        // Must seek sequentially for MediaSource-backed videos
        for (const time of timestamps) {
          const frame = await captureFrameAtTime(video, time);
          extracted.push(frame);
        }
        setKeyframes(extracted);
      } catch (error) {
        console.error('Failed to extract keyframes:', error);
      } finally {
        setIsExtractingFrames(false);
      }
    };

    const handleLoadedData = () => {
      // Using a small timeout to allow the browser to stabilize the video state
      setTimeout(extract, 100);
    };

    video.addEventListener('loadeddata', handleLoadedData);

    if (video.readyState >= 2) {
      handleLoadedData();
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [isPreparingVideo, captureFrameAtTime, isExtractingFrames]);

  const handleSaveShot = async () => {
    setIsSaved(true);
    const video = videoRef.current;
    if (!video) {
      setIsSaved(false);
      return;
    }

    const getThumbnail = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (keyframes.length > 0) {
          resolve(keyframes[0].base64);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas context.'));

        video.currentTime = 0.1;

        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            async (blob) => {
              if (blob) {
                try {
                  const b64 = await fileToBase64(new File([blob], 'thumb.png'));
                  resolve(b64);
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new Error('Canvas toBlob returned null.'));
              }
            },
            'image/png',
            0.9,
          );
        };

        video.addEventListener('seeked', onSeeked, { once: true });
        if (video.readyState >= 2) {
          // HAVE_CURRENT_DATA
          onSeeked();
        }
      });
    };

    try {
      const thumbnailBase64 = await getThumbnail();
      onSaveShot(thumbnailBase64);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save shot:', error);
      alert('Could not save shot.');
      setIsSaved(false);
    }
  };

  const handleDownloadVideo = async () => {
    let urlToDownload: string | null = null;
    let isObjectUrl = false;

    if (combinedVideoForDownload) {
      urlToDownload = URL.createObjectURL(combinedVideoForDownload);
      isObjectUrl = true;
    } else {
      urlToDownload = videoUrl;
    }

    if (!urlToDownload) return;

    const fileName = combinedVideoForDownload
      ? `veo_studio_combined_${Date.now()}.mp4`
      : `veo_studio_video_${Date.now()}.mp4`;

    const a = document.createElement('a');
    a.href = urlToDownload;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (isObjectUrl) {
      URL.revokeObjectURL(urlToDownload);
    }
  };

  const handleStartExtension = () => {
    if (keyframes.length > 0) {
      const lastFrame = keyframes[keyframes.length - 1];
      onStartExtensionAssistant(lastFrame);
    } else {
      alert(
        'Keyframes are still being extracted. Please wait a moment to start the extension workflow.',
      );
    }
  };

  const applyCriticFix = () => {
    if (complianceResult?.revisedPrompt) {
      onPromptRevised(complianceResult.revisedPrompt);
      setShowComplianceDetails(false);
    }
  }

  const isSequenceInProgress =
    sequenceProgress && sequenceProgress.current < sequenceProgress.total;

  const isExtendedExternalVideo = !!originalVideoForExtension;

  return (
    <div className="w-full h-full flex flex-row items-start gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700 shadow-2xl overflow-hidden">
      {/* Left Column: Video & Primary Actions */}
      <div className="w-2/3 h-full flex flex-col items-center gap-4 overflow-y-auto">
        <div className="text-center w-full">
          <h2 className="text-2xl font-bold text-gray-200">
            {isExtendedExternalVideo
              ? 'Continuity Engine Result'
              : 'Your Creation is Ready!'}
          </h2>
          {sequenceProgress && (
            <p className="text-md text-indigo-400 font-medium mt-1">
              Shot {sequenceProgress.current} of {sequenceProgress.total}
            </p>
          )}
        </div>

        <div className="w-full relative aspect-video rounded-lg overflow-hidden bg-black shadow-lg flex-shrink-0">
          {isPreparingVideo ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin mb-4"></div>
              <p>Stitching videos for playback...</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              key={videoUrl + (originalVideoForExtension?.file.name ?? '')}
              controls
              autoPlay
              loop
              className="w-full h-full object-contain"
            />
          )}

          {/* Critic Agent Badge */}
          {!isPreparingVideo && (
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
              {isAnalyzingCompliance && (
                <div className="bg-black/70 text-indigo-300 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 backdrop-blur-sm border border-indigo-500/30">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                  AI Critic Analyzing...
                </div>
              )}
              {complianceResult && !isAnalyzingCompliance && (
                <div className="relative">
                  <button
                    onClick={() => setShowComplianceDetails(!showComplianceDetails)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all shadow-lg ${complianceResult.score >= 80
                        ? 'bg-green-900/80 border-green-500 text-green-300'
                        : complianceResult.score >= 50
                          ? 'bg-yellow-900/80 border-yellow-500 text-yellow-300'
                          : 'bg-red-900/80 border-red-500 text-red-300'
                      }`}
                  >
                    <ShieldCheckIcon className="w-4 h-4" />
                    <span className="font-bold">{complianceResult.score}% Match</span>
                  </button>

                  {showComplianceDetails && (
                    <div className="absolute bottom-full right-0 mb-2 w-72 bg-gray-900 border border-gray-600 rounded-xl p-4 shadow-2xl z-20 animate-in fade-in slide-in-from-bottom-2">
                      <h4 className="text-sm font-bold text-white mb-2 flex justify-between items-center">
                        Critic Report
                        <span className="text-xs font-normal text-gray-400">Gemini 3.0 Vision</span>
                      </h4>
                      <p className="text-xs text-gray-300 leading-relaxed mb-3">
                        "{complianceResult.critique}"
                      </p>
                      {complianceResult.revisedPrompt && (
                        <button
                          onClick={applyCriticFix}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <SparklesIcon className="w-3 h-3" />
                          Apply Fix & Retry
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full flex flex-wrap justify-center gap-4">
          {isSequenceInProgress && (
            <button
              onClick={onContinueSequence}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
              Continue Sequence
              <ChevronsRightIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleSaveShot}
            disabled={isSaved}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors disabled:bg-teal-800 disabled:cursor-not-allowed">
            {isSaved ? (
              <>
                <CheckIcon className="w-5 h-5" /> Saved!
              </>
            ) : (
              <>
                <BookmarkPlusIcon className="w-5 h-5" /> Save Shot
              </>
            )}
          </button>
          <button
            onClick={handleDownloadVideo}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
            <DownloadIcon className="w-5 h-5" />
            {isExtendedExternalVideo
              ? 'Download Combined Clip'
              : 'Download Video'}
          </button>
          {/* Google Drive Save Button */}
          {driveEnabled && (
            driveConnected ? (
              <button
                onClick={async () => {
                  setIsUploadingToDrive(true);
                  setDriveUploadSuccess(false);
                  try {
                    const fileName = `veo_studio_video_${Date.now()}.mp4`;
                    const result = await uploadToDrive(videoUrl, fileName, 'video/mp4');
                    if (result.success) {
                      setDriveUploadSuccess(true);
                      setTimeout(() => setDriveUploadSuccess(false), 3000);
                    } else {
                      alert(`Drive upload failed: ${result.error}`);
                    }
                  } catch (e) {
                    alert('Failed to upload to Google Drive');
                  } finally {
                    setIsUploadingToDrive(false);
                  }
                }}
                disabled={isUploadingToDrive || driveUploadSuccess}
                className={`flex items-center gap-2 px-5 py-2.5 font-semibold rounded-lg transition-colors ${driveUploadSuccess
                    ? 'bg-green-600 text-white'
                    : isUploadingToDrive
                      ? 'bg-blue-800 text-blue-200 cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}>
                {driveUploadSuccess ? (
                  <><CheckIcon className="w-5 h-5" /> Saved to Drive!</>
                ) : isUploadingToDrive ? (
                  <>Uploading...</>
                ) : (
                  <>Save to Google Drive</>
                )}
              </button>
            ) : (
              <button
                onClick={() => connectDrive()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors">
                Connect Google Drive
              </button>
            )
          )}
          <button
            onClick={onStartNewProject}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors">
            <PlusIcon className="w-5 h-5" />
            Start New Project
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mt-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700/80 hover:bg-gray-600 text-gray-300 hover:text-white font-semibold rounded-lg transition-colors text-sm">
            <ArrowPathIcon className="w-4 h-4" />
            Retry Last Prompt
          </button>
          {canExtend && !isExtendedExternalVideo && (
            <>
              <button
                onClick={onExtendVideo}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/80 hover:bg-gray-600 text-gray-300 hover:text-white font-semibold rounded-lg transition-colors text-sm">
                <FilmIcon className="w-4 h-4" />
                Extend (Simple)
              </button>
              <button
                onClick={handleStartExtension}
                disabled={keyframes.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-800/80 hover:bg-indigo-700 text-indigo-200 hover:text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <SparklesIcon className="w-4 h-4" />
                Extend with Assistant
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right Column: Keyframe Refinement Assistant */}
      <div className="w-1/3 h-full flex flex-col bg-gray-900/50 rounded-lg border border-gray-700">
        <KeyframeRefinementAssistant
          keyframes={keyframes}
          isExtractingFrames={isPreparingVideo || isExtractingFrames}
          originalPrompt={lastConfig?.prompt ?? ''}
          dogma={activeDogma}
          onPromptRevised={onPromptRevised}
          onUseFrameAsStart={onContinueFromFrame}
          onEditFrame={onEditCapturedFrame}
        />
      </div>
    </div>
  );
};

export default VideoResult;