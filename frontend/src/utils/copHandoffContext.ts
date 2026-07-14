import type { CopCommandHandoffContext } from '../types';

export const COP_COMMAND_HANDOFF_CONTEXT_KEY = 'ipoc.cop.commandHandoffContext';
const COP_COMMAND_HANDOFF_CONTEXT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isHandoffExpired = (context: CopCommandHandoffContext): boolean => {
  if (!context.generatedUtc) {
    return false;
  }

  const generatedUtcEpoch = Date.parse(context.generatedUtc);
  if (Number.isNaN(generatedUtcEpoch)) {
    return false;
  }

  return (Date.now() - generatedUtcEpoch) > COP_COMMAND_HANDOFF_CONTEXT_MAX_AGE_MS;
};

export const readCopCommandHandoffContext = (
  target?: CopCommandHandoffContext['target'],
): CopCommandHandoffContext | null => {
  const raw = localStorage.getItem(COP_COMMAND_HANDOFF_CONTEXT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsedUnknown = JSON.parse(raw) as unknown;
    if (!isObjectRecord(parsedUnknown)) {
      return null;
    }

    const parsed = parsedUnknown as CopCommandHandoffContext;
    if (target && parsed.target !== target) {
      return null;
    }

    if (isHandoffExpired(parsed)) {
      localStorage.removeItem(COP_COMMAND_HANDOFF_CONTEXT_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const clearCopCommandHandoffContext = () => {
  localStorage.removeItem(COP_COMMAND_HANDOFF_CONTEXT_KEY);
};

export const writeCopCommandHandoffContext = (context: CopCommandHandoffContext) => {
  localStorage.setItem(COP_COMMAND_HANDOFF_CONTEXT_KEY, JSON.stringify(context));
};
