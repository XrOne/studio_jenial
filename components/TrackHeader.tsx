/**
 * TrackHeader Component
 * Displays track label with lock/mute/visibility controls
 */

import React from 'react';
import { Track } from '../types/timeline';

interface TrackHeaderProps {
    track: Track;
    isSelected: boolean;
    onSelect: () => void;
    onToggleLock: () => void;
    onToggleMute: () => void;
    onToggleVisible: () => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
    track,
    isSelected,
    onSelect,
    onToggleLock,
    onToggleMute,
    onToggleVisible
}) => {
    const isVideoTrack = track.type === 'video';

    return (
        <div
            className={`
                flex items-center justify-between px-2 border-b border-[#333] cursor-pointer
                transition-colors
                ${isSelected ? 'bg-indigo-900/30' : 'bg-[#1a1a1a] hover:bg-[#252525]'}
            `}
            style={{ height: track.height }}
            onClick={onSelect}
        >
            {/* Track Name */}
            <span className={`
                text-[10px] font-bold uppercase tracking-wider
                ${isVideoTrack ? 'text-blue-400' : 'text-cyan-400'}
                ${track.locked ? 'opacity-50' : ''}
            `}>
                {track.name}
            </span>

            {/* Controls */}
            <div className="flex items-center gap-1">
                {/* Visibility (video) / Mute (audio) */}
                {isVideoTrack ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
                        className={`p-0.5 rounded transition-colors ${track.visible
                                ? 'text-gray-400 hover:text-white'
                                : 'text-red-500 hover:text-red-400'
                            }`}
                        title={track.visible ? 'Masquer piste' : 'Afficher piste'}
                    >
                        <span className="material-symbols-outlined text-xs">
                            {track.visible ? 'visibility' : 'visibility_off'}
                        </span>
                    </button>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
                        className={`p-0.5 rounded transition-colors ${track.muted
                                ? 'text-red-500 hover:text-red-400'
                                : 'text-gray-400 hover:text-white'
                            }`}
                        title={track.muted ? 'Activer audio' : 'Couper audio'}
                    >
                        <span className="material-symbols-outlined text-xs">
                            {track.muted ? 'volume_off' : 'volume_up'}
                        </span>
                    </button>
                )}

                {/* Lock */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                    className={`p-0.5 rounded transition-colors ${track.locked
                            ? 'text-yellow-500 hover:text-yellow-400'
                            : 'text-gray-500 hover:text-white'
                        }`}
                    title={track.locked ? 'Déverrouiller piste' : 'Verrouiller piste'}
                >
                    <span className="material-symbols-outlined text-xs">
                        {track.locked ? 'lock' : 'lock_open'}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default TrackHeader;
