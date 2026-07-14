import { clearCopCommandHandoffContext } from './copHandoffContext';
import type { NotifyHandler } from '../notifications/types';

export const dismissCopHandoffBanner = (
  workspaceLabel: string,
  setDismissed: (dismissed: boolean) => void,
  notify: NotifyHandler,
) => {
  setDismissed(true);
  notify(`COP handoff context dismissed for ${workspaceLabel} workspace.`, 'info');
};

export const clearCopHandoffBannerContext = (
  setContext: (value: null) => void,
  setDismissed: (dismissed: boolean) => void,
  notify: NotifyHandler,
  resetDismissedTo = true,
) => {
  clearCopCommandHandoffContext();
  setContext(null);
  setDismissed(resetDismissedTo);
  notify('COP handoff context cleared.', 'success');
};
