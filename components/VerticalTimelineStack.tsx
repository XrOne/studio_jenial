/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VerticalTimelineStack - Main vertical timeline component
 * Displays segments stacked vertically with expansion for iterations
 */
'use client';

import * as React from 'react';
import {
  VerticalTimelineStackProps,
  SegmentWithUI,
  SegmentRevision
} from '../types/timeline';
import VerticalSegmentCard from './VerticalSegmentCard';

/**
 * VerticalTimelineStack
 * 
 * Main container for the vertical timeline view.
 * Displays all segments from the horizontal timeline in a vertical stack.
 * Each segment can be expanded to show its iterations.
 */
export default function VerticalTimelineStack({
  segments,
  selectedSegmentIds,
  expandedSegmentIds,
  onSegmentClick,
  onSegmentExpand,
  onSegmentCollapse,
  onIterationClick,
  onIterationValidate,
  onIterationDelete,
  onSegmentLock,
  onSegmentUnlock,
  onReprompt,
}: VerticalTimelineStackProps) {

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1e1e] overflow-hidden">
      {/* Segments Stack */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {segments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <p>Aucun segment dans la timeline</p>
          </div>
        ) : (
          segments.map((segment) => (
            <VerticalSegmentCard
              key={segment.id}
              segment={segment}
              isSelected={selectedSegmentIds.includes(segment.id)}
              isExpanded={expandedSegmentIds.includes(segment.id)}
              onClick={() => onSegmentClick(segment.id)}
              onExpand={() => onSegmentExpand(segment.id)}
              onCollapse={() => onSegmentCollapse(segment.id)}
              onLock={() => onSegmentLock(segment.id)}
              onUnlock={() => onSegmentUnlock(segment.id)}
              onIterationClick={(revisionId) => onIterationClick(segment.id, revisionId)}
              onIterationValidate={(revisionId) => onIterationValidate(segment.id, revisionId)}
              onIterationDelete={(revisionId) => onIterationDelete(segment.id, revisionId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
