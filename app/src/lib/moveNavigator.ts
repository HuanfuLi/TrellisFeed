/**
 * moveNavigator.ts — Central routing logic for suggested moves.
 *
 * Maps move types to screen navigation with proper context passing.
 * Handles both web (React Router) and mobile (Capacitor) platforms.
 */

import type { NavigateFunction } from 'react-router-dom';
import type { PlannedMove } from '../types';

/**
 * Navigation configuration mapping move types to screen paths.
 */
const MOVE_TYPE_ROUTES = {
  review: {
    screen: 'review',
    paramKey: 'conceptId', // ReviewScreen loads flashcards for this concept
  },
  deepdive: {
    screen: 'ask', // Navigate to AskScreen for Q&A deep dive
    paramKey: 'questionId',
  },
  connection: {
    screen: 'ask', // Navigate to QuestionDetailScreen
    paramKey: 'questionId',
  },
  podcast: {
    screen: 'podcast', // Navigate to PodcastScreen
    paramKey: 'conceptId',
  },
} as const;

/**
 * Context to pass via location state during navigation.
 * Allows target screen to receive the full move + linked resource info.
 */
export interface MoveNavigationState {
  move: PlannedMove;
  linkedResource: PlannedMove['linkedResource'];
  fromScreen: 'planner' | 'explore' | 'other';
  timestamp: number;
}

/**
 * Navigate to a screen based on move type and linkedResource.
 *
 * @param move - The PlannedMove object from suggestions
 * @param navigate - React Router's useNavigate() hook
 * @param options - Navigation options (fromScreen, replace)
 *
 * @returns Promise<boolean> - true if navigation succeeded, false if invalid move
 *
 * @example
 * ```typescript
 * const handleAcceptMove = async (move: PlannedMove) => {
 *   const success = await navigateToMove(move, navigate);
 *   if (!success) toast('Invalid move configuration', 'error');
 * };
 * ```
 */
export async function navigateToMove(
  move: PlannedMove,
  navigate: NavigateFunction,
  options: {
    fromScreen?: 'planner' | 'explore' | 'other';
    replace?: boolean;
  } = {}
): Promise<boolean> {
  const { fromScreen = 'planner', replace = false } = options;

  // Validate: move must have linkedResource for navigation
  if (!move.linkedResource?.id) {
    console.warn('[moveNavigator] Move missing linkedResource:', move);
    return false;
  }

  const route = MOVE_TYPE_ROUTES[move.moveType];
  if (!route) {
    console.warn(`[moveNavigator] Unknown move type: ${move.moveType}`);
    return false;
  }

  // Build navigation state
  const navigationState: MoveNavigationState = {
    move,
    linkedResource: move.linkedResource,
    fromScreen,
    timestamp: Date.now(),
  };

  // Build navigation path based on move type
  const path = buildMoveNavigationPath(move, route);

  if (!path) {
    console.warn('[moveNavigator] Could not build navigation path for move:', move);
    return false;
  }

  try {
    navigate(path, {
      state: navigationState,
      replace,
    });
    return true;
  } catch (error) {
    console.error('[moveNavigator] Navigation failed:', error, move);
    return false;
  }
}

/**
 * Build the navigation path for a move based on its type and linkedResource.
 *
 * @internal — Used by navigateToMove(); exported for testing
 *
 * @param move - PlannedMove with linkedResource
 * @param route - Route configuration from MOVE_TYPE_ROUTES
 *
 * @returns Navigation path string (e.g., '/review', '/ask/question-123')
 *          or null if path cannot be built
 */
export function buildMoveNavigationPath(
  move: PlannedMove,
  route: (typeof MOVE_TYPE_ROUTES)[keyof typeof MOVE_TYPE_ROUTES]
): string | null {
  const { linkedResource } = move;

  if (!linkedResource?.id) return null;

  switch (route.screen) {
    case 'review':
      // ReviewScreen doesn't use URL params — context passed via state
      return '/review';

    case 'ask':
      // QuestionDetailScreen uses :id URL param
      return `/ask/${linkedResource.id}`;

    case 'podcast':
      // PodcastScreen doesn't use URL params — context passed via state
      return '/podcast';

    default:
      console.warn(`[moveNavigator] Unknown screen in route: ${route.screen}`);
      return null;
  }
}

/**
 * Parse navigation state from a screen's location.
 *
 * Used by target screens to extract move context after navigation.
 *
 * @param locationState - location.state from useLocation()
 * @returns Parsed MoveNavigationState or null if not a move navigation
 *
 * @example
 * ```typescript
 * const location = useLocation();
 * const moveState = parseMoveNavigationState(location.state);
 * if (moveState) {
 *   console.log('Navigated from:', moveState.fromScreen);
 *   console.log('Linked resource:', moveState.linkedResource);
 * }
 * ```
 */
export function parseMoveNavigationState(
  locationState: unknown
): MoveNavigationState | null {
  if (!locationState || typeof locationState !== 'object') return null;

  const state = locationState as Record<string, unknown>;

  // Validate required fields
  if (!state.linkedResource || !state.move || !state.fromScreen) {
    return null;
  }

  return {
    move: state.move as PlannedMove,
    linkedResource: state.linkedResource as PlannedMove['linkedResource'],
    fromScreen: state.fromScreen as 'planner' | 'explore' | 'other',
    timestamp: (state.timestamp as number) || Date.now(),
  };
}

/**
 * Utility: Get human-readable destination label for a move.
 *
 * Used in UI feedback, logging, analytics.
 *
 * @param move - The PlannedMove
 * @returns Readable destination (e.g., "Review Screen", "Post Detail")
 */
export function getMoveDestination(move: PlannedMove): string {
  const route = MOVE_TYPE_ROUTES[move.moveType];
  if (!route) return 'Unknown';

  const screenLabels: Record<string, string> = {
    review: 'Review Screen',
    ask: 'Question Detail',
    posts: 'Post Detail',
    podcast: 'Podcast Screen',
  };

  return screenLabels[route.screen] || 'Unknown';
}
