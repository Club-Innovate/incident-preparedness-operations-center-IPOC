export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export type AlertStatus = 'new' | 'acknowledged';

export type NotificationSettings = {
  toastEnabled: boolean;
  alertFeedEnabled: boolean;
  enabledVariants: Record<ToastVariant, boolean>;
  enabledStatuses: Record<AlertStatus, boolean>;
};

export type AlertSource = 'system' | 'incident' | 'facilities' | 'reports' | 'security';

export type AlertFeedItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  occurredAt: string;
  status: AlertStatus;
  source: AlertSource;
};

export type UiAlert = {
  alertId: number;
  message: string;
  variant: ToastVariant;
  source: AlertSource;
  occurredAt: string;
  status: AlertStatus;
};

export type CreateUiAlertRequest = {
  message: string;
  variant: ToastVariant;
  source: AlertSource;
  status: AlertStatus;
};

export type ToastState = {
  show: boolean;
  message: string;
  variant: ToastVariant;
  sequence: number;
};

export type NotifyHandler = (message: string, variant: ToastVariant) => void;
