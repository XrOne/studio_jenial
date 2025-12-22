import React, { useState, useRef, useEffect } from 'react';

interface BananaAxisControlProps {
    onUpdate: (instruction: string) => void;
    className?: string;
}

export const BananaAxisControl: React.FC<BananaAxisControlProps> = ({ onUpdate, className = '' }) => {
    // State for visual feedback
    const [azimuth, setAzimuth] = useState<number>(180); // 180 = Front (Bottom of circle)
    const [elevation, setElevation] = useState<number>(50); // 50 = Eye Level (Middle)
    const [isDragging, setIsDragging] = useState<'azimuth' | 'elevation' | null>(null);

    // Convert technical values to Prompt Instructions
    const generateInstruction = (az: number, el: number) => {
        let anglePrompt = '';
        let heightPrompt = '';

        // 1. Azimuth (Rotation around subject)
        // Map 0-360 to specific views. 
        // 180 = Front, 90 = Right Side (seeing left profile), 270 = Left Side (seeing right profile), 0 = Back

        // Normalize to 0-360
        const normAz = (az % 360 + 360) % 360;

        if (normAz >= 135 && normAz <= 225) anglePrompt = "Front view, face camera";
        else if (normAz > 225 && normAz < 315) anglePrompt = "Three-quarter view from left";
        else if (normAz >= 315 || normAz <= 45) anglePrompt = "Back view, from behind";
        else if (normAz > 45 && normAz < 135) anglePrompt = "Three-quarter view from right";

        // Exact Profiles
        if (Math.abs(normAz - 90) < 15) anglePrompt = "Side profile view from right";
        if (Math.abs(normAz - 270) < 15) anglePrompt = "Side profile view from left";

        // 2. Elevation (Height)
        // 0 = Top (Bird), 50 = Eye, 100 = Bottom (Worm)
        if (el < 15) heightPrompt = "Bird's-eye view, top-down overhead shot";
        else if (el < 40) heightPrompt = "High angle shot, looking down";
        else if (el > 60 && el < 85) heightPrompt = "Low angle shot, looking up from below";
        else if (el >= 85) heightPrompt = "Worm's-eye view, extreme low angle ground level";
        else heightPrompt = "Eye-level shot";

        return `Change camera angle to: ${anglePrompt}, ${heightPrompt}. Maintain absolute character and style consistency.`;
    };

    const handleAzimuthStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging('azimuth');
        updateAzimuthFromEvent(e);
    };

    const handleElevationStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging('elevation');
        updateElevationFromEvent(e);
    };

    const handleEnd = () => {
        if (isDragging) {
            const instruction = generateInstruction(azimuth, elevation);
            onUpdate(instruction);
        }
        setIsDragging(null);
    };

    const updateAzimuthFromEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const svg = document.getElementById('banana-compass-svg');
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = clientX - centerX;
        const dy = clientY - centerY;

        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        angle = (angle + 90 + 360) % 360; // Adjust so 0 is Top

        setAzimuth(angle);
    };

    const updateElevationFromEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const slider = document.getElementById('banana-elevation-slider');
        if (!slider) return;

        const rect = slider.getBoundingClientRect();
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        // Calculate percentage from top (0) to bottom (100)
        let percent = ((clientY - rect.top) / rect.height) * 100;
        percent = Math.max(0, Math.min(100, percent));

        setElevation(percent);
    };

    // Global listeners for drag
    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (isDragging === 'azimuth') updateAzimuthFromEvent(e);
            if (isDragging === 'elevation') updateElevationFromEvent(e);
        };

        const handleUp = () => handleEnd();

        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchmove', handleMove);
            window.addEventListener('touchend', handleUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging]);

    // Helper to place dot on circle
    // Azimuth 0 is Top (0,-1) in logic, but standard math 0 is Right (1,0)
    // We want visual 0 at Top.
    const radius = 40;
    const cx = 50;
    const cy = 50;
    // Convert azimuth (0=Top, clockwise) to radians for SVG (0=Right, clockwise)
    // Az 0 (Top) -> -90 deg
    // Az 90 (Right) -> 0 deg
    // Az 180 (Bottom) -> 90 deg
    const rad = (azimuth - 90) * (Math.PI / 180);
    const dotX = cx + radius * Math.cos(rad);
    const dotY = cy + radius * Math.sin(rad);

    return (
        <div className={`flex gap-6 items-center justify-center p-4 bg-gray-900/50 rounded-xl border border-gray-700 ${className}`}>

            {/* 1. Compass (Azimuth) */}
            <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-gray-400 font-medium tracking-wider">ROTATION</span>
                <div
                    className="relative w-24 h-24 cursor-pointer group"
                    onMouseDown={handleAzimuthStart}
                    onTouchStart={handleAzimuthStart}
                >
                    <svg id="banana-compass-svg" viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
                        {/* Background Circle */}
                        <circle cx="50" cy="50" r="48" fill="#1f2937" stroke="#374151" strokeWidth="2" />

                        {/* Tick Marks */}
                        <line x1="50" y1="2" x2="50" y2="10" stroke="#4b5563" strokeWidth="2" /> {/* N */}
                        <line x1="98" y1="50" x2="90" y2="50" stroke="#4b5563" strokeWidth="2" /> {/* E */}
                        <line x1="50" y1="98" x2="50" y2="90" stroke="#4b5563" strokeWidth="2" /> {/* S */}
                        <line x1="2" y1="50" x2="10" y2="50" stroke="#4b5563" strokeWidth="2" /> {/* W */}

                        {/* Labels */}
                        <text x="50" y="24" textAnchor="middle" className="text-[10px] fill-gray-500 font-bold select-none">BACK</text>
                        <text x="50" y="85" textAnchor="middle" className="text-[10px] fill-gray-500 font-bold select-none">FRONT</text>

                        {/* Active Indicator Line */}
                        <line x1="50" y1="50" x2={dotX} y2={dotY} stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2" />

                        {/* Handle Dot */}
                        <circle
                            cx={dotX}
                            cy={dotY}
                            r="6"
                            className={`fill-indigo-500 transition-transform ${isDragging === 'azimuth' ? 'scale-125' : 'group-hover:scale-110'}`}
                            stroke="white"
                            strokeWidth="2"
                        />
                        {/* Center Pivot */}
                        <circle cx="50" cy="50" r="3" fill="#4b5563" />
                    </svg>
                </div>
            </div>

            {/* 2. Elevation Slider (Vertical) */}
            <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-gray-400 font-medium tracking-wider">HEIGHT</span>
                <div
                    id="banana-elevation-slider"
                    className="relative w-8 h-24 bg-gray-800 rounded-full border border-gray-600 cursor-pointer overflow-hidden group"
                    onMouseDown={handleElevationStart}
                    onTouchStart={handleElevationStart}
                >
                    {/* Background Gradient to show Sky vs Ground */}
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 via-transparent to-amber-900/40 opacity-50" />

                    {/* Center Line (Eye Level) */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-600" />

                    {/* Thumb */}
                    <div
                        className={`absolute left-1 right-1 h-2 bg-indigo-500 rounded-full shadow-lg border border-white transition-transform ${isDragging === 'elevation' ? 'scale-110' : 'group-hover:scale-105'}`}
                        style={{ top: `calc(${elevation}% - 4px)` }}
                    />

                    {/* Icons/Text Overlay */}
                    <span className="absolute top-1 left-0 right-0 text-[8px] text-center text-gray-400 select-none">HIGH</span>
                    <span className="absolute bottom-1 left-0 right-0 text-[8px] text-center text-gray-400 select-none">LOW</span>
                </div>
            </div>

            {/* Status Display Text */}
            <div className="absolute bottom-[-30px] left-0 right-0 text-center">
                <span className="text-xs text-indigo-300 font-mono opacity-80">
                    {isDragging ? 'Adjusting...' : 'Click to Set Angle'}
                </span>
            </div>

        </div>
    );
};
