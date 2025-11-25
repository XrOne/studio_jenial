/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {
  BirdsEyeViewIcon,
  CraneDownIcon,
  CraneUpIcon,
  DollyInIcon,
  DollyOutIcon,
  DroneIcon,
  DutchAngleIcon,
  EyeLevelIcon,
  HighAngleIcon,
  LowAngleIcon,
  PanLeftIcon,
  PanRightIcon,
  StaticIcon,
  TiltDownIcon,
  TiltUpIcon,
  WormsEyeViewIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './icons';

interface CameraMovement {
  id: string;
  name: string;
  text: string;
  icon: React.ReactNode;
}

interface Angle {
  id: string;
  name: string;
  text: string;
  icon: React.ReactNode;
}

const movements: CameraMovement[] = [
  {
    id: 'static',
    name: 'Static Shot',
    text: '',
    icon: <StaticIcon />,
  },
  {
    id: 'dolly-in',
    name: 'Dolly In',
    text: 'Camera: slow dolly in.',
    icon: <DollyInIcon />,
  },
  {
    id: 'dolly-out',
    name: 'Dolly Out',
    text: 'Camera: slow dolly out.',
    icon: <DollyOutIcon />,
  },
  {
    id: 'pan-left',
    name: 'Pan Left',
    text: 'Camera: smooth pan left.',
    icon: <PanLeftIcon />,
  },
  {
    id: 'pan-right',
    name: 'Pan Right',
    text: 'Camera: smooth pan right.',
    icon: <PanRightIcon />,
  },
  {
    id: 'tilt-up',
    name: 'Tilt Up',
    text: 'Camera: slow tilt up.',
    icon: <TiltUpIcon />,
  },
  {
    id: 'tilt-down',
    name: 'Tilt Down',
    text: 'Camera: slow tilt down.',
    icon: <TiltDownIcon />,
  },
  {
    id: 'zoom-in',
    name: 'Zoom In',
    text: 'Camera: slow zoom in.',
    icon: <ZoomInIcon />,
  },
  {
    id: 'zoom-out',
    name: 'Zoom Out',
    text: 'Camera: slow zoom out.',
    icon: <ZoomOutIcon />,
  },
  {
    id: 'drone-flyover',
    name: 'Drone Flyover',
    text: 'Camera: smooth drone flyover.',
    icon: <DroneIcon />,
  },
  {
    id: 'crane-up',
    name: 'Crane Up (Bottom to Top)',
    text: 'Camera: smooth crane up.',
    icon: <CraneUpIcon />,
  },
  {
    id: 'crane-down',
    name: 'Crane Down (Top to Bottom)',
    text: 'Camera: smooth crane down.',
    icon: <CraneDownIcon />,
  },
];

const angles: Angle[] = [
  {
    id: 'eye-level',
    name: 'Eye-Level',
    text: 'Angle: eye-level.',
    icon: <EyeLevelIcon />,
  },
  {
    id: 'high-angle',
    name: 'High Angle',
    text: 'Angle: high angle.',
    icon: <HighAngleIcon />,
  },
  {
    id: 'low-angle',
    name: 'Low Angle',
    text: 'Angle: low angle.',
    icon: <LowAngleIcon />,
  },
  {
    id: 'birds-eye',
    name: "Bird's-Eye View",
    text: "Angle: bird's-eye view.",
    icon: <BirdsEyeViewIcon />,
  },
  {
    id: 'worms-eye',
    name: "Worm's-Eye View",
    text: "Angle: worm's-eye view.",
    icon: <WormsEyeViewIcon />,
  },
  {
    id: 'dutch-angle',
    name: 'Dutch Angle',
    text: 'Angle: dutch angle.',
    icon: <DutchAngleIcon />,
  },
];

interface CameraKitProps {
  onSelectMovement: (text: string) => void;
  onSelectAngle: (text: string) => void;
}

const CameraKit: React.FC<CameraKitProps> = ({
  onSelectMovement,
  onSelectAngle,
}) => {
  return (
    <div className="bg-[#2c2c2e] p-2 rounded-xl border border-gray-700 flex items-center justify-between">
      <span className="text-sm font-semibold text-gray-300 px-2 flex-shrink-0">
        Camera Kit
      </span>
      <div className="flex items-center gap-1 overflow-x-auto">
        {movements.map((movement) => (
          <div key={movement.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelectMovement(movement.text)}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors icon-button"
              aria-label={movement.name}>
              {React.cloneElement(movement.icon as React.ReactElement<{ className?: string }>, {
                className: 'w-5 h-5',
              })}
            </button>
            <div
              role="tooltip"
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
              {movement.name}
            </div>
          </div>
        ))}
        <div className="w-px h-6 bg-gray-600 mx-2 flex-shrink-0" />
        {angles.map((angle) => (
          <div key={angle.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelectAngle(angle.text)}
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
  );
};

export default CameraKit;