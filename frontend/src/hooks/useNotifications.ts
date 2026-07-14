import { useCallback, useEffect, useState } from 'react';
import {
  acknowledgeUiAlert,
  clearUiAlerts,
  createUiAlert,
  deleteUiAlert,
  getUiAlerts,
} from '../api';
import type {
  AlertFeedItem,
  AlertStatus,
  AlertSource,
  CreateUiAlertRequest,
  NotificationSettings,
  ToastState,
  ToastVariant,
  UiAlert,
} from '../notifications/types';

let alertIdSeed = Date.now();

function useNotifications(isAuthenticated: boolean) {
  const defaultSettings: NotificationSettings = {
    toastEnabled: true,
    alertFeedEnabled: true,
    enabledVariants: {
      success: true,
      danger: true,
      warning: true,
      info: true,
    },
    enabledStatuses: {
      new: true,
      acknowledged: true,
    },
  };

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    if (typeof window === 'undefined') {
      return defaultSettings;
    }

    const raw = window.localStorage.getItem('ipoc.notificationSettings');
    if (!raw) {
      return defaultSettings;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
      return {
        toastEnabled: parsed.toastEnabled ?? defaultSettings.toastEnabled,
        alertFeedEnabled: parsed.alertFeedEnabled ?? defaultSettings.alertFeedEnabled,
        enabledVariants: {
          success: parsed.enabledVariants?.success ?? defaultSettings.enabledVariants.success,
          danger: parsed.enabledVariants?.danger ?? defaultSettings.enabledVariants.danger,
          warning: parsed.enabledVariants?.warning ?? defaultSettings.enabledVariants.warning,
          info: parsed.enabledVariants?.info ?? defaultSettings.enabledVariants.info,
        },
        enabledStatuses: {
          new: parsed.enabledStatuses?.new ?? defaultSettings.enabledStatuses.new,
          acknowledged: parsed.enabledStatuses?.acknowledged ?? defaultSettings.enabledStatuses.acknowledged,
        },
      };
    } catch {
      return defaultSettings;
    }
  });

  const [toastState, setToastState] = useState<ToastState>({ show: false, message: '', variant: 'info', sequence: 0 });
  const [alertFeed, setAlertFeed] = useState<AlertFeedItem[]>([]);

  const toFeedItem = useCallback((item: UiAlert): AlertFeedItem => ({
    id: item.alertId,
    message: item.message,
    variant: item.variant,
    occurredAt: item.occurredAt,
    status: item.status,
    source: item.source,
  }), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setAlertFeed([]);
      return;
    }

    let cancelled = false;

    const loadAlerts = async () => {
      try {
        const persistedAlerts = await getUiAlerts();
        if (cancelled) {
          return;
        }

        setAlertFeed(persistedAlerts.map((item) => toFeedItem(item)));
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[AlertCenter] Failed to load persisted alerts.', error);
        }
      }
    };

    void loadAlerts();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, toFeedItem]);

  const showToast = useCallback((message: string, variant: ToastVariant, source: AlertSource = 'system') => {
    if (!notificationSettings.enabledVariants[variant]) {
      return;
    }

    const alertItem: AlertFeedItem = {
      id: ++alertIdSeed,
      message,
      variant,
      occurredAt: new Date().toISOString(),
      status: 'new',
      source,
    };

    if (notificationSettings.alertFeedEnabled && notificationSettings.enabledStatuses.new) {
      setAlertFeed((current) => [alertItem, ...current]);

      if (isAuthenticated) {
        const request: CreateUiAlertRequest = {
          message,
          variant,
          source,
          status: 'new',
        };

        void createUiAlert(request)
          .then((persisted) => {
            setAlertFeed((current) => current.map((item) => (
              item.id === alertItem.id
                ? {
                  ...item,
                  id: persisted.alertId,
                }
                : item
            )));
          })
          .catch((error) => {
            if (import.meta.env.DEV) {
              console.error('[AlertCenter] Failed to persist alert.', error);
            }
          });
      }
    }

    if (notificationSettings.toastEnabled) {
      setToastState((current) => ({
        show: false,
        message,
        variant,
        sequence: current.sequence + 1,
      }));

      // Force a re-show on next frame so identical consecutive messages still fade in.
      requestAnimationFrame(() => {
        setToastState((current) => ({
          ...current,
          show: true,
        }));
      });
    }
  }, [notificationSettings]);

  const closeToast = useCallback(() => {
    setToastState((current) => ({ ...current, show: false }));
  }, []);

  const removeAlertItem = useCallback((alertId: number) => {
    setAlertFeed((current) => current.filter((item) => item.id !== alertId));

    if (isAuthenticated) {
      void deleteUiAlert(alertId)
        .catch((error) => {
          if (import.meta.env.DEV) {
            console.error('[AlertCenter] Failed to delete alert.', error);
          }
        });
    }
  }, [isAuthenticated]);

  const acknowledgeAlertItem = useCallback((alertId: number) => {
    if (!notificationSettings.enabledStatuses.acknowledged) {
      setAlertFeed((current) => current.filter((item) => item.id !== alertId));

      if (isAuthenticated) {
        void deleteUiAlert(alertId)
          .catch((error) => {
            if (import.meta.env.DEV) {
              console.error('[AlertCenter] Failed to delete alert while acknowledging with ACK disabled.', error);
            }
          });
      }
      return;
    }

    setAlertFeed((current) => current.map((item) => {
      if (item.id !== alertId) {
        return item;
      }

      return {
        ...item,
        status: 'acknowledged',
      };
    }));

    if (isAuthenticated) {
      void acknowledgeUiAlert(alertId)
        .catch((error) => {
          if (import.meta.env.DEV) {
            console.error('[AlertCenter] Failed to acknowledge alert.', error);
          }
        });
    }
  }, [isAuthenticated, notificationSettings.enabledStatuses.acknowledged]);

  const clearAlertFeed = useCallback(() => {
    setAlertFeed([]);

    if (isAuthenticated) {
      void clearUiAlerts()
        .catch((error) => {
          if (import.meta.env.DEV) {
            console.error('[AlertCenter] Failed to clear alerts.', error);
          }
        });
    }
  }, [isAuthenticated]);

  const updateNotificationSettings = useCallback((updater: (current: NotificationSettings) => NotificationSettings) => {
    setNotificationSettings((current) => {
      const next = updater(current);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ipoc.notificationSettings', JSON.stringify(next));
      }

      return next;
    });
  }, []);

  const setVariantEnabled = useCallback((variant: ToastVariant, enabled: boolean) => {
    updateNotificationSettings((current) => ({
      ...current,
      enabledVariants: {
        ...current.enabledVariants,
        [variant]: enabled,
      },
    }));
  }, [updateNotificationSettings]);

  const setStatusEnabled = useCallback((status: AlertStatus, enabled: boolean) => {
    updateNotificationSettings((current) => ({
      ...current,
      enabledStatuses: {
        ...current.enabledStatuses,
        [status]: enabled,
      },
    }));
  }, [updateNotificationSettings]);

  const setToastEnabled = useCallback((enabled: boolean) => {
    updateNotificationSettings((current) => ({
      ...current,
      toastEnabled: enabled,
    }));
  }, [updateNotificationSettings]);

  const setAlertFeedEnabled = useCallback((enabled: boolean) => {
    updateNotificationSettings((current) => ({
      ...current,
      alertFeedEnabled: enabled,
    }));
  }, [updateNotificationSettings]);

  return {
    toastState,
    alertFeed,
    notificationSettings,
    showToast,
    closeToast,
    removeAlertItem,
    acknowledgeAlertItem,
    clearAlertFeed,
    setVariantEnabled,
    setStatusEnabled,
    setToastEnabled,
    setAlertFeedEnabled,
  };
}

export { useNotifications };
