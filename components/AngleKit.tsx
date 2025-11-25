/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {
  BirdsEyeViewIcon,
  DutchAngleIcon,
  EyeLevelIcon,
  HighAngleIcon,
  LowAngleIcon,
  WormsEyeViewIcon,
} from './icons';

interface Angle {
  id: string;
  name: string;
  angle: string;
  icon: React.ReactNode;
}

const angles: Angle[] = [
  {
    id: 'eye-level',
    name: 'Eye-Level',
    angle: 'eye-level',
    icon: <EyeLevelIcon />,
  },
  {
    id: 'high-angle',
    name: 'High Angle',
    angle: 'high angle',
    icon: <HighAngleIcon />,
  },
  {
    id: 'low-angle',
    name: 'Low Angle',
    angle: 'low angle',
    icon: <LowAngleIcon />,
  },
  {
    id: 'birds-eye',
    name: "Bird's-Eye View",
    angle: "bird's-eye view",
    icon: <BirdsEyeViewIcon />,
  },
  {
    id: 'worms-eye',
    name: "Worm's-Eye View",
    angle: "worm's-eye view",
    icon: <WormsEyeViewIcon />,
  },
  {
    id: 'dutch-angle',
    name: 'Dutch Angle',
    angle: 'dutch angle',
    icon: <DutchAngleIcon />,
  },
];

interface AngleKitProps {
  onSelectAngle: (angle: string) => void;
}

const AngleKit: React.FC<AngleKitProps> = ({ onSelectAngle }) => {
  return (
    <div className="bg-[#2c2c2e] p-2 rounded-xl border border-gray-700 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-300 px-2">
          Camera Angle
        </span>
        <div className="flex items-center gap-1">
          {angles.map((angle) => (
            <div key={angle.id} className="relative group">
              <button
                type="button"
                onClick={() => onSelectAngle(angle.angle)}
                className="p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors icon-button"
                aria-label={angle.name}>
                {React.cloneElement(angle.icon as React.ReactElement<{ className?: string }>, {
                  className: 'w-5 h-5',
                })}
              </button>
              <div
                role="tooltip"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                {angle.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AngleKit;