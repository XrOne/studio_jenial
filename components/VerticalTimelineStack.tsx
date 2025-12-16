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
    VerticalTimelineSegment,
    SegmentIteration
} from '../types-vertical-timeline';
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
        <div className="vertical-timeline-stack">
            {/* Header */}
            <div className="vertical-timeline-header">
                <h3>Vertical Timeline Stack</h3>
                <button className="vertical-timeline-menu-btn" aria-label="Options">
                    ⋮
                </button>
            </div>

            {/* Segments Stack */}
            <div className="vertical-timeline-segments">
                {segments.length === 0 ? (
                    <div className="vertical-timeline-empty">
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
                            onIterationClick={(iterationId) => onIterationClick(segment.id, iterationId)}
                            onIterationValidate={(iterationId) => onIterationValidate(segment.id, iterationId)}
                            onIterationDelete={(iterationId) => onIterationDelete(segment.id, iterationId)}
                        />
                    ))
                )}
            </div>

            {/* Styles */}
            <style jsx>{`
        .vertical-timeline-stack {
          display: flex;
          flex-direction: column;
          width: 300px;
          height: 100%;
          background: var(--surface-secondary, #1e1e1e);
          border-left: 1px solid var(--border-color, #333);
          overflow: hidden;
        }
        
        .vertical-timeline-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #333);
        }
        
        .vertical-timeline-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #fff);
        }
        
        .vertical-timeline-menu-btn {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          cursor: pointer;
          padding: 4px 8px;
          font-size: 16px;
        }
        
        .vertical-timeline-menu-btn:hover {
          color: var(--text-primary, #fff);
        }
        
        .vertical-timeline-segments {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .vertical-timeline-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary, #888);
          font-size: 14px;
        }
      `}</style>
        </div>
    );
}
