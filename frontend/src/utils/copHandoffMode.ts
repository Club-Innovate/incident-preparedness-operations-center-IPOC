import type { CopCommandHandoffContext } from '../types';

export const resolvePlanningCadenceModeFromCopHandoff = (
  context: CopCommandHandoffContext,
): 'standard' | 'compressed' | 'stabilization' => {
  if (context.geoOverlayStressFilter === 'high') {
    return 'compressed';
  }

  if (context.geoOverlayLayer === 'bed') {
    return 'stabilization';
  }

  return 'standard';
};

export const resolveOperationsModeFromCopHandoff = (
  context: CopCommandHandoffContext,
): 'balanced' | 'surge' | 'communications' => {
  if (context.geoOverlayStressFilter === 'high') {
    return 'surge';
  }

  if (context.geoOverlayLayer === 'incident') {
    return 'communications';
  }

  return 'balanced';
};

export const resolveAfterActionModeFromCopHandoff = (
  context: CopCommandHandoffContext,
): 'evidence' | 'closure' | 'improvement' => {
  if (context.geoOverlayStressFilter === 'high') {
    return 'improvement';
  }

  if (context.geoOverlayLayer === 'incident') {
    return 'closure';
  }

  return 'evidence';
};
