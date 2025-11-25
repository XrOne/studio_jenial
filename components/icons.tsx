/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {
  ArrowUp,
  // AudioLines removed to avoid export errors
  Baseline,
  BookMarked,
  BookmarkPlus,
  Camera,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  ChevronsDown,
  Download,
  Eraser,
  Expand,
  ExternalLink,
  Film,
  Image,
  KeyRound,
  Languages,
  Layers,
  LayoutGrid,
  Lock,
  MessageSquare,
  Move,
  Paintbrush,
  Paperclip,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Shrink,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Tv,
  UploadCloud,
  Users,
  Video,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const defaultProps = {
  strokeWidth: 1.5,
};

export const KeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <KeyRound {...defaultProps} {...props} />
);

export const ShieldCheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ShieldCheck {...defaultProps} {...props} />
);

export const LockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Lock {...defaultProps} {...props} />
);

export const ArrowPathIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <RefreshCw {...defaultProps} {...props} />;

export const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Sparkles {...defaultProps} {...props} />;

export const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Plus {...defaultProps} {...props} />
);

export const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ChevronDown {...defaultProps} {...props} />;

export const ChevronsRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ChevronsRight {...defaultProps} {...props} />;

export const SlidersHorizontalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <SlidersHorizontal {...defaultProps} {...props} />;

export const ArrowRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const RectangleStackIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Layers {...defaultProps} {...props} />;

export const XMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <X {...defaultProps} {...props} />
);

export const TextModeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Baseline {...defaultProps} {...props} />;

export const FramesModeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Image {...defaultProps} {...props} />;

export const ReferencesModeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Film {...defaultProps} {...props} />;

export const TvIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Tv {...defaultProps} {...props} />
);

export const FilmIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Film {...defaultProps} {...props} />
);

// Manually implemented to avoid import errors with ArrowDown in some environments
export const CurvedArrowDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
    strokeWidth={3} // Override strokeWidth
  >
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);

export const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Check {...defaultProps} {...props} />
);

export const CameraIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Camera {...defaultProps} {...props} />
);
export const PencilIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Pencil {...defaultProps} {...props} />
);

export const BookMarkedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <BookMarked {...defaultProps} {...props} />;

export const Trash2Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Trash2 {...defaultProps} {...props} />
);

export const BookmarkPlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <BookmarkPlus {...defaultProps} {...props} />;

export const LayoutGridIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <LayoutGrid {...defaultProps} {...props} />;

export const LanguagesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Languages {...defaultProps} {...props} />;

export const VideoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Video {...defaultProps} {...props} />
);

export const UsersIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Users {...defaultProps} {...props} />
);

export const UploadCloudIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <UploadCloud {...defaultProps} {...props} />;

export const SwapHorizontallyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="m16 3 4 4-4 4" />
    <path d="M20 7H4" />
    <path d="m8 21-4-4 4-4" />
    <path d="M4 17h16" />
  </svg>
);

export const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Download {...defaultProps} {...props} />
);

export const PaintbrushIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Paintbrush {...defaultProps} {...props} />;
export const EraserIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Eraser {...defaultProps} {...props} />
);
export const ExpandIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Expand {...defaultProps} {...props} />
);
export const ShrinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Shrink {...defaultProps} {...props} />
);
export const MagicWandIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <WandSparkles {...defaultProps} {...props} />;

export const MoveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Move {...defaultProps} {...props} />
);

export const ScissorsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Scissors {...defaultProps} {...props} />
);
export const PaperclipIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Paperclip {...defaultProps} {...props} />
);

export const MessageSquareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <MessageSquare {...defaultProps} {...props} />;

export const WaveformIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="M2 10v3" />
    <path d="M6 6v11" />
    <path d="M10 3v18" />
    <path d="M14 8v7" />
    <path d="M18 5v13" />
    <path d="M22 10v4" />
  </svg>
);

// --- Video Camera Movement Icons (Manual Implementations) ---

export const StaticIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Camera {...defaultProps} {...props} />
);

// ArrowRightFromLine replacement
export const DollyInIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="M3 5v14" />
    <path d="M7 12h14" />
    <path d="m15 18 6-6-6-6" />
  </svg>
);

// ArrowLeftFromLine replacement
export const DollyOutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="M21 5v14" />
    <path d="M17 12H3" />
    <path d="m9 6-6 6 6 6" />
  </svg>
);

export const PanLeftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ChevronsLeft {...defaultProps} {...props} />
);
export const PanRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ChevronsRight {...defaultProps} {...props} />;
export const TiltUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ChevronsUp {...defaultProps} {...props} />
);
export const TiltDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ChevronsDown {...defaultProps} {...props} />;
export const ZoomInIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ZoomIn {...defaultProps} {...props} />
);
export const ZoomOutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ZoomOut {...defaultProps} {...props} />
);
export const DroneIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Plane {...defaultProps} {...props} />
);

// ArrowUpFromLine replacement
export const CraneUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="m18 9-6-6-6 9" />
    <path d="M12 3v14" />
    <path d="M5 21h14" />
  </svg>
);

// ArrowDownToLine replacement
export const CraneDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="M12 3v14" />
    <path d="m19 12-7 7-7-7" />
    <path d="M5 21h14" />
  </svg>
);

// --- Image Camera Angle Icons (Manual Implementations) ---

export const EyeLevelIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="M2 12h20" />
    <path d="M12 5.5V18.5" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>
);

// ArrowDownToDot replacement
export const HighAngleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="M12 2v14" />
    <path d="m19 11-7 7-7-7" />
    <circle cx="12" cy="21" r="1" />
  </svg>
);

// ArrowUpFromDot replacement
export const LowAngleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="m5 9 7-7 7 7" />
    <path d="M12 2v16" />
    <circle cx="12" cy="21" r="1" />
  </svg>
);

// CircleDot replacement (Bird's Eye)
export const BirdsEyeViewIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

// ArrowUpFromLine replacement (Worm's Eye - same as Crane Up essentially)
export const WormsEyeViewIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...defaultProps}
    {...props}>
    <path d="m18 9-6-6-6 9" />
    <path d="M12 3v14" />
    <path d="M5 21h14" />
  </svg>
);

export const DutchAngleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <RotateCcw {...defaultProps} {...props} />;

export const ExternalLinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ExternalLink {...defaultProps} {...props} />;
