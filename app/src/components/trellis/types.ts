// Shared type contracts for all three Trellis rendering variants (A/C/V).
// Components import from here; variants implement the same contract.

import type { TrellisLayout, TrellisAnchorNode, LeafState } from '../../services/trellis-state.service.ts';
import type { VinePathSpec } from '../../services/trellis-layout.service.ts';

export type { TrellisLayout, TrellisAnchorNode, LeafState, VinePathSpec };

export type TrellisVariant = 'A' | 'C';

export interface TrellisBackgroundProps {
  // Common background props all three variants satisfy
  viewBoxW: number;
  viewBoxH: number;
  className?: string;
}

export interface LeafRenderNode {
  anchorId: string;
  anchorName: string;
  x: number;
  y: number;
  state: LeafState;
  branchColor: string;
  qaCount: number;
  reviewedCount: number;
  overdueCount: number;
  blossomSinceDate?: string;
}

export const LEAF_HIT_TARGET_PX = 44; // WCAG 2.5.5 minimum touch target (UI-SPEC Spacing)
