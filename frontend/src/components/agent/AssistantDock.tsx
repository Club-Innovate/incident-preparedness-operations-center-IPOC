import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Badge, Card, Form, ListGroup } from 'react-bootstrap';
import {
  completeAgentChat,
  createAgentAnalyticsEvent,
  getAgentPredictiveDemandSupply,
  getAgentConfigHealth,
  getAgentConnectivityHealth,
  getAgentConversationHistory,
  getAgentPersonalizationPolicy,
  getAgentPersonalizationPolicyHistory,
  getUserReportPresets,
  saveAgentPersonalization,
  saveAgentPersonalizationPolicy,
  upsertUserReportPreset,
} from '../../api';
import IconActionButton from '../common/IconActionButton';
import LabelWithInfo from '../common/LabelWithInfo';
import type { NotifyHandler } from '../../notifications/types';
import type {
  AgentConnectivityHealth,
  AgentPersonalizationPolicy,
  AgentPersonalizationPolicyAuditItem,
  AgentPersonalizationPolicyState,
  PagedResult,
} from '../../types';

type AgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  confidenceScore?: number | null;
  citations?: string[];
  citationLinks?: Array<{ label: string; url?: string | null; sourceId?: string | null; score?: number | null }>;
  retrievalStatus?: string;
  approvalStatus?: 'not-required' | 'pending' | 'approved' | 'rejected';
  fallbackUsed?: boolean;
  attachments?: Array<{ name: string; size: number; type: string }>;
};

type AssistantPreferences = {
  avatar: 'copilot' | 'radar' | 'spark' | 'shield' | 'analyst' | 'custom';
  theme: 'auto' | 'light' | 'dark' | 'midnight' | 'violet';
  fontScale: number;
  customAvatarDataUrl?: string | null;
  accentColor: string;
  assistantBubbleColor: string;
  userBubbleColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowColor: string;
  shadowInset: boolean;
  showDiagnostics: boolean;
  requireApprovalForAll: boolean;
  stylePolicy: 'user' | 'global';
};

type AssistantStyleProfile = {
  version: 1;
  exportedAtUtc: string;
  preferences: AssistantPreferences;
};

type AssistantSession = {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
};

type AssistantDockProps = {
  isAuthenticated: boolean;
  authRoles?: string[];
  onNotify: NotifyHandler;
};

const ASSISTANT_LOCAL_STATE_KEY = 'ipoc.agent.dock.state';
const ASSISTANT_LOCAL_PREFERENCES_KEY = 'ipoc.agent.dock.preferences.v1';
const ASSISTANT_GLOBAL_STYLE_KEY = 'ipoc.agent.dock.global.style.v1';
const ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY = 'ipoc.agent.dock.local.preferences.present.v1';
const ASSISTANT_SCOPE = 'agent-assistant-dock';
const ASSISTANT_PRESET = 'default';
const ASSISTANT_PREFERENCES_SCOPE = 'agent-assistant-preferences';
const ASSISTANT_PREFERENCES_PRESET = 'default';
const ASSISTANT_ANALYTICS_SCOPE = 'agent-assistant-analytics';
const ASSISTANT_ANALYTICS_PRESET = 'default';
const ASSISTANT_AZURE_AI_ENABLED = import.meta.env.VITE_IPOC_AGENT_AZURE_AI === 'true';
const ASSISTANT_AZURE_OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT ?? '';
const ASSISTANT_AZURE_OPENAI_API_VERSION = import.meta.env.VITE_AZURE_OPENAI_API_VERSION ?? '2026-05-01';
const ASSISTANT_EMOJI_OPTIONS = ['😀', '👍', '✅', '⚠️', '🚑', '🔥', '📌', '📊', '🙏', '🎯'];
const ASSISTANT_QUICK_PROMPTS = [
  'Summarize the top open incidents.',
  'Show critical resource shortages by location.',
  'What changed in the last operational period?',
];
const ASSISTANT_COLOR_SWATCHES = ['#6d28d9', '#9333ea', '#0d6efd', '#0ea5e9', '#10b981', '#ea9a61', '#ef4444'];

type AssistantAnalyticsState = {
  openCount: number;
  sessionCreatedCount: number;
  sessionRenamedCount: number;
  messageSentCount: number;
  lastOpenedAt: string | null;
  lastMessageAt: string | null;
};

const defaultPreferences: AssistantPreferences = {
  avatar: 'copilot',
  theme: 'auto',
  fontScale: 100,
  customAvatarDataUrl: null,
  accentColor: '#6d28d9',
  assistantBubbleColor: '#eef2ff',
  userBubbleColor: '#dbeafe',
  shadowX: 0,
  shadowY: 8,
  shadowBlur: 26,
  shadowSpread: -8,
  shadowColor: '#0f172a33',
  shadowInset: false,
  showDiagnostics: false,
  requireApprovalForAll: false,
  stylePolicy: 'user',
};

function normalizePreferences(input?: Partial<AssistantPreferences>): AssistantPreferences {
  const source = input ?? {};

  return {
    avatar: source.avatar === 'radar' || source.avatar === 'spark' || source.avatar === 'shield' || source.avatar === 'analyst' || source.avatar === 'custom'
      ? source.avatar
      : defaultPreferences.avatar,
    theme: source.theme === 'light' || source.theme === 'dark' || source.theme === 'midnight' || source.theme === 'violet'
      ? source.theme
      : defaultPreferences.theme,
    fontScale: typeof source.fontScale === 'number'
      ? Math.max(90, Math.min(120, Math.round(source.fontScale)))
      : defaultPreferences.fontScale,
    customAvatarDataUrl: typeof source.customAvatarDataUrl === 'string' ? source.customAvatarDataUrl : null,
    accentColor: typeof source.accentColor === 'string' ? source.accentColor : defaultPreferences.accentColor,
    assistantBubbleColor: typeof source.assistantBubbleColor === 'string' ? source.assistantBubbleColor : defaultPreferences.assistantBubbleColor,
    userBubbleColor: typeof source.userBubbleColor === 'string' ? source.userBubbleColor : defaultPreferences.userBubbleColor,
    shadowX: typeof source.shadowX === 'number' ? Math.max(-32, Math.min(32, Math.round(source.shadowX))) : defaultPreferences.shadowX,
    shadowY: typeof source.shadowY === 'number' ? Math.max(-32, Math.min(32, Math.round(source.shadowY))) : defaultPreferences.shadowY,
    shadowBlur: typeof source.shadowBlur === 'number' ? Math.max(0, Math.min(64, Math.round(source.shadowBlur))) : defaultPreferences.shadowBlur,
    shadowSpread: typeof source.shadowSpread === 'number' ? Math.max(-24, Math.min(24, Math.round(source.shadowSpread))) : defaultPreferences.shadowSpread,
    shadowColor: typeof source.shadowColor === 'string' ? source.shadowColor : defaultPreferences.shadowColor,
    shadowInset: source.shadowInset === true,
    showDiagnostics: source.showDiagnostics === true,
    requireApprovalForAll: source.requireApprovalForAll === true,
    stylePolicy: source.stylePolicy === 'global' ? 'global' : 'user',
  };
}

function isDefaultPreferences(input: AssistantPreferences): boolean {
  return input.avatar === defaultPreferences.avatar
    && input.theme === defaultPreferences.theme
    && input.fontScale === defaultPreferences.fontScale
    && (input.customAvatarDataUrl ?? null) === (defaultPreferences.customAvatarDataUrl ?? null)
    && input.accentColor === defaultPreferences.accentColor
    && input.assistantBubbleColor === defaultPreferences.assistantBubbleColor
    && input.userBubbleColor === defaultPreferences.userBubbleColor
    && input.shadowX === defaultPreferences.shadowX
    && input.shadowY === defaultPreferences.shadowY
    && input.shadowBlur === defaultPreferences.shadowBlur
    && input.shadowSpread === defaultPreferences.shadowSpread
    && input.shadowColor === defaultPreferences.shadowColor
    && input.shadowInset === defaultPreferences.shadowInset
    && input.showDiagnostics === defaultPreferences.showDiagnostics
    && input.requireApprovalForAll === defaultPreferences.requireApprovalForAll
    && input.stylePolicy === defaultPreferences.stylePolicy;
}

const defaultAnalyticsState: AssistantAnalyticsState = {
  openCount: 0,
  sessionCreatedCount: 0,
  sessionRenamedCount: 0,
  messageSentCount: 0,
  lastOpenedAt: null,
  lastMessageAt: null,
};

function createDefaultSession(): AssistantSession {
  const now = new Date().toISOString();

  return {
    id: `session-${Date.now()}`,
    title: 'New conversation',
    messages: [
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'AI Incident Co-Pilot is ready. Ask for summaries, impact predictions, action recommendations, or ICS draft help.',
        createdAt: now,
        confidenceScore: 0.78,
        citations: ['COP baseline operational dataset'],
        approvalStatus: 'not-required',
        fallbackUsed: false,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function requiresApproval(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return normalized.includes('recommend')
    || normalized.includes('deploy')
    || normalized.includes('evacu')
    || normalized.includes('resource order')
    || normalized.includes('ics-')
    || normalized.includes('priority');
}

function AssistantDock({ isAuthenticated, authRoles = [], onNotify }: AssistantDockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPersonalizationPanel, setShowPersonalizationPanel] = useState(false);
  const [showConversationsPanel, setShowConversationsPanel] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sessions, setSessions] = useState<AssistantSession[]>([createDefaultSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionRenameText, setSessionRenameText] = useState('');
  const [preferences, setPreferences] = useState<AssistantPreferences>(defaultPreferences);
  const [analytics, setAnalytics] = useState<AssistantAnalyticsState>(defaultAnalyticsState);
  const [azureConfigReady, setAzureConfigReady] = useState(true);
  const [azureBackendConfigStatus, setAzureBackendConfigStatus] = useState<'unknown' | 'healthy' | 'configuration-required' | 'unavailable'>('unknown');
  const [azureConnectivity, setAzureConnectivity] = useState<AgentConnectivityHealth | null>(null);
  const [assistantOpenedTracked, setAssistantOpenedTracked] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickPromptsPanel, setShowQuickPromptsPanel] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<Array<{ name: string; size: number; type: string }>>([]);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
  const launcherButtonRef = useRef<HTMLButtonElement | null>(null);
  const messageStreamRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const importProfileInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);
  const hasLocalPreferencesRef = useRef(false);
  const [localStateHydrated, setLocalStateHydrated] = useState(false);
  const [serverStateHydrated, setServerStateHydrated] = useState(false);
  const [policyLoadCompleted, setPolicyLoadCompleted] = useState(false);
  const [policyState, setPolicyState] = useState<AgentPersonalizationPolicyState | null>(null);
  const [policySyncStatus, setPolicySyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [policyHistory, setPolicyHistory] = useState<PagedResult<AgentPersonalizationPolicyAuditItem>>({
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 10,
  });
  const [policyHistoryLoadState, setPolicyHistoryLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [expandedPolicyHistoryIds, setExpandedPolicyHistoryIds] = useState<number[]>([]);
  const sessionsRef = useRef<AssistantSession[]>(sessions);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const preferencesRef = useRef<AssistantPreferences>(preferences);
  const analyticsRef = useRef<AssistantAnalyticsState>(analytics);
  const personalizationUpdatedUtcRef = useRef<string | null>(null);
  const personalizationLastSubmittedSignatureRef = useRef<string | null>(null);

  const buildPersonalizationSignature = (prefs: AssistantPreferences): string => JSON.stringify({
    avatar: prefs.avatar,
    theme: prefs.theme,
    fontScale: prefs.fontScale,
  });

  const persistAssistantLocalStateNow = () => {
    try {
      localStorage.setItem(ASSISTANT_LOCAL_STATE_KEY, JSON.stringify({
        sessions: sessionsRef.current,
        activeSessionId: activeSessionIdRef.current,
        preferences: preferencesRef.current,
        analytics: analyticsRef.current,
      }));
    } catch {
      // ignore oversized local state payloads
    }

    if (hasLocalPreferencesRef.current || !isDefaultPreferences(preferencesRef.current)) {
      try {
        localStorage.setItem(ASSISTANT_LOCAL_PREFERENCES_KEY, JSON.stringify(preferencesRef.current));
        localStorage.setItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY, '1');
      } catch {
        // ignore local preference persistence errors
      }
    }
  };

  const loadPolicyHistory = (pageNumber: number, pageSize: number, onFinally?: () => void): void => {
    setPolicyHistoryLoadState('loading');
    void getAgentPersonalizationPolicyHistory(pageNumber, pageSize)
      .then((result) => {
        setPolicyHistory(result);
        setPolicyHistoryLoadState('loaded');
      })
      .catch(() => {
        setPolicyHistoryLoadState('error');
      })
      .finally(() => {
        onFinally?.();
      });
  };

  const normalizedRoles = useMemo(() => authRoles.map((role) => role.trim().toUpperCase()), [authRoles]);
  const isAssistantAdmin = useMemo(
    () => normalizedRoles.some((role) => [
      'SYSTEM_ADMIN',
      'KDHE_ADMIN',
      'INCIDENT_COMMANDER',
      'DATA_OPS_ADMIN',
      'LOOKUP_ADMIN',
      'ADMIN',
      'ADMINISTRATOR',
    ].includes(role)),
    [normalizedRoles],
  );

  const governancePreferencesLocked = useMemo(
    () => !(isAssistantAdmin || policyState?.canManagePolicy === true),
    [isAssistantAdmin, policyState?.canManagePolicy],
  );

  const mapPolicyToPreferences = (policy: AgentPersonalizationPolicy, current: AssistantPreferences): AssistantPreferences => {
    const normalizedTheme = policy.allowedThemes.includes(current.theme)
      ? current.theme
      : (policy.allowedThemes[0] ?? defaultPreferences.theme) as AssistantPreferences['theme'];

    const normalizedAvatar = policy.allowedAvatars.includes(current.avatar)
      ? current.avatar
      : (policy.allowedAvatars[0] ?? defaultPreferences.avatar) as AssistantPreferences['avatar'];

    const minFont = Math.min(policy.allowedFontScaleMin, policy.allowedFontScaleMax);
    const maxFont = Math.max(policy.allowedFontScaleMin, policy.allowedFontScaleMax);

    const normalizedAccent = policy.allowedAccentColors.length === 0 || policy.allowedAccentColors.includes(current.accentColor)
      ? current.accentColor
      : policy.allowedAccentColors[0];

    const next = {
      ...current,
      theme: normalizedTheme,
      avatar: normalizedAvatar,
      fontScale: Math.max(minFont, Math.min(maxFont, current.fontScale)),
      accentColor: normalizedAccent,
    };

    if (policy.enforceGlobalStyle) {
      return {
        ...next,
        showDiagnostics: policy.showDiagnostics,
        requireApprovalForAll: policy.requireApprovalForAll,
        stylePolicy: 'global',
      };
    }

    if (policy.lockGovernanceToggles) {
      return {
        ...next,
        showDiagnostics: policy.showDiagnostics,
        requireApprovalForAll: policy.requireApprovalForAll,
      };
    }

    return next;
  };

  const applyRestrictedPreferencePolicy = (prefs: AssistantPreferences): AssistantPreferences => {
    if (isAssistantAdmin) {
      return prefs;
    }

    return {
      ...prefs,
      showDiagnostics: defaultPreferences.showDiagnostics,
      requireApprovalForAll: defaultPreferences.requireApprovalForAll,
      stylePolicy: defaultPreferences.stylePolicy,
    };
  };

  useEffect(() => {
    if (!ASSISTANT_AZURE_AI_ENABLED) {
      setAzureConfigReady(true);
      return;
    }

    const hasDeployment = ASSISTANT_AZURE_OPENAI_DEPLOYMENT.trim().length > 0;
    const hasApiVersion = ASSISTANT_AZURE_OPENAI_API_VERSION.trim().length > 0;
    setAzureConfigReady(hasDeployment && hasApiVersion);
  }, []);

  useEffect(() => {
    if (!ASSISTANT_AZURE_AI_ENABLED || !isAuthenticated) {
      setAzureBackendConfigStatus('unknown');
      setAzureConnectivity(null);
      return;
    }

    let cancelled = false;

    const loadHealth = async () => {
      try {
        const health = await getAgentConfigHealth();
        if (!cancelled) {
          setAzureBackendConfigStatus(health.status === 'Healthy' ? 'healthy' : 'configuration-required');
        }
      } catch {
        if (!cancelled) {
          setAzureBackendConfigStatus('unavailable');
        }
      }

      try {
        const connectivity = await getAgentConnectivityHealth();
        if (!cancelled) {
          setAzureConnectivity(connectivity);
        }
      } catch {
        if (!cancelled) {
          setAzureConnectivity(null);
        }
      }
    };

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!ASSISTANT_AZURE_AI_ENABLED || !isAuthenticated) {
      setPolicyLoadCompleted(true);
      return;
    }

    let cancelled = false;

    const loadPolicy = async () => {
      try {
        const policyState = await getAgentPersonalizationPolicy();
        if (cancelled) {
          return;
        }

        setPolicyState(policyState);

        setPreferences((current) => {
          const applied = mapPolicyToPreferences(policyState.policy, current);
          return governancePreferencesLocked
            ? applyRestrictedPreferencePolicy(applied)
            : applied;
        });
      } catch {
        // retain local preference fallback
        if (!cancelled) {
          setPolicyState(null);
        }
      } finally {
        if (!cancelled) {
          setPolicyLoadCompleted(true);
        }
      }
    };

    void loadPolicy();

    return () => {
      cancelled = true;
    };
  }, [governancePreferencesLocked, isAuthenticated]);

  useEffect(() => {
    if (!ASSISTANT_AZURE_AI_ENABLED || !isAuthenticated || !showPersonalizationPanel) {
      return;
    }

    let cancelled = false;
    loadPolicyHistory(1, policyHistory.pageSize, () => {
      if (cancelled) {
        return;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, policyHistory.pageSize, showPersonalizationPanel]);

  useEffect(() => {
    setExpandedPolicyHistoryIds([]);
  }, [policyHistory.items, policyHistory.pageNumber]);

  const azureConnectivityErrorSummary = useMemo(() => {
    if (!azureConnectivity || azureConnectivity.status === 'Healthy') {
      return null;
    }

    const issues: string[] = [];

    if (!azureConnectivity.azureOpenAiConnected && azureConnectivity.azureOpenAiError) {
      issues.push(`OpenAI: ${azureConnectivity.azureOpenAiError}`);
    }

    if (!azureConnectivity.azureAiSearchConnected && azureConnectivity.azureAiSearchError) {
      issues.push(`Search: ${azureConnectivity.azureAiSearchError}`);
    }

    return issues.length > 0
      ? issues.join(' | ')
      : 'Azure AI connectivity probe is failing.';
  }, [azureConnectivity]);

  const connectionStatus = useMemo(() => {
    if (!ASSISTANT_AZURE_AI_ENABLED) {
      return {
        label: 'AI disabled',
        className: 'status-disabled',
      };
    }

    if (!isAuthenticated) {
      return {
        label: 'Authentication required',
        className: 'status-auth-required',
      };
    }

    if (azureConnectivity?.status === 'Healthy') {
      return {
        label: 'Connected',
        className: 'status-connected',
      };
    }

    if (azureBackendConfigStatus === 'configuration-required') {
      return {
        label: 'Configuration required',
        className: 'status-warning',
      };
    }

    if (azureBackendConfigStatus === 'unavailable') {
      return {
        label: 'Service unavailable',
        className: 'status-error',
      };
    }

    return {
      label: 'Connecting',
      className: 'status-pending',
    };
  }, [azureBackendConfigStatus, azureConnectivity?.status, isAuthenticated]);

  const persistGlobalStyleDefaults = (prefs: AssistantPreferences): void => {
    if (!isAssistantAdmin || prefs.stylePolicy !== 'global') {
      return;
    }

    try {
      const globalProfile: AssistantStyleProfile = {
        version: 1,
        exportedAtUtc: new Date().toISOString(),
        preferences: prefs,
      };

      localStorage.setItem(ASSISTANT_GLOBAL_STYLE_KEY, JSON.stringify({
        ...globalProfile,
      }));
    } catch {
      // best-effort local persistence
    }
  };

  const trackAnalyticsEvent = (eventName: string, sessionId?: string, metadataJson?: string) => {
    if (!ASSISTANT_AZURE_AI_ENABLED || !isAuthenticated) {
      return;
    }

    void createAgentAnalyticsEvent({
      eventName,
      sessionId,
      occurredAt: new Date().toISOString(),
      metadataJson,
    }).catch(() => {
      // local analytics fallback remains active
    });
  };

  useEffect(() => {
    setActiveSessionId((current) => {
      if (current) {
        return current;
      }

      return sessions[0]?.id ?? null;
    });
  }, [sessions]);

  useEffect(() => {
    const persistedLocalPreferenceMarker = localStorage.getItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY) === '1';
    const persistedPreferencesRaw = localStorage.getItem(ASSISTANT_LOCAL_PREFERENCES_KEY);
    const hasDedicatedPreferencePayload = persistedLocalPreferenceMarker && persistedPreferencesRaw !== null;

    try {
      if (persistedPreferencesRaw) {
        const parsedPreferences = normalizePreferences(JSON.parse(persistedPreferencesRaw) as Partial<AssistantPreferences>);
        if (!isDefaultPreferences(parsedPreferences)) {
          hasLocalPreferencesRef.current = true;
          localStorage.setItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY, '1');
          setPreferences(applyRestrictedPreferencePolicy(parsedPreferences));
        } else {
          localStorage.removeItem(ASSISTANT_LOCAL_PREFERENCES_KEY);
          localStorage.removeItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY);
        }
      }
    } catch {
      // ignore invalid local preferences payload
    }

    const persisted = localStorage.getItem(ASSISTANT_LOCAL_STATE_KEY);
    if (!persisted) {
      setLocalStateHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as {
        sessions?: AssistantSession[];
        activeSessionId?: string | null;
        preferences?: Partial<AssistantPreferences>;
        analytics?: Partial<AssistantAnalyticsState>;
      };

      if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
        setSessions(parsed.sessions);
      }

      if (typeof parsed.activeSessionId === 'string' || parsed.activeSessionId === null) {
        setActiveSessionId(parsed.activeSessionId);
      }

      if (!hasDedicatedPreferencePayload && parsed.preferences && typeof parsed.preferences === 'object') {
        hasLocalPreferencesRef.current = true;
        localStorage.setItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY, '1');
        setPreferences(applyRestrictedPreferencePolicy(normalizePreferences(parsed.preferences)));
      }

      if (parsed.analytics && typeof parsed.analytics === 'object') {
        setAnalytics({
          openCount: typeof parsed.analytics.openCount === 'number' ? Math.max(0, Math.round(parsed.analytics.openCount)) : 0,
          sessionCreatedCount: typeof parsed.analytics.sessionCreatedCount === 'number' ? Math.max(0, Math.round(parsed.analytics.sessionCreatedCount)) : 0,
          sessionRenamedCount: typeof parsed.analytics.sessionRenamedCount === 'number' ? Math.max(0, Math.round(parsed.analytics.sessionRenamedCount)) : 0,
          messageSentCount: typeof parsed.analytics.messageSentCount === 'number' ? Math.max(0, Math.round(parsed.analytics.messageSentCount)) : 0,
          lastOpenedAt: typeof parsed.analytics.lastOpenedAt === 'string' ? parsed.analytics.lastOpenedAt : null,
          lastMessageAt: typeof parsed.analytics.lastMessageAt === 'string' ? parsed.analytics.lastMessageAt : null,
        });
      }
    } catch {
      // ignore invalid persisted state
    }

    setLocalStateHydrated(true);
  }, []);

  useEffect(() => {
    if (preferences.stylePolicy !== 'global') {
      return;
    }

    try {
      const persisted = localStorage.getItem(ASSISTANT_GLOBAL_STYLE_KEY);
      if (!persisted) {
        return;
      }

      const parsed = JSON.parse(persisted) as Partial<AssistantStyleProfile>;
      if (parsed.version !== 1 || !parsed.preferences) {
        return;
      }

      setPreferences((current) => {
        const merged = normalizePreferences(parsed.preferences);
        return {
          ...merged,
          showDiagnostics: current.showDiagnostics,
          requireApprovalForAll: current.requireApprovalForAll,
          stylePolicy: current.stylePolicy,
        };
      });
    } catch {
      // ignore invalid profile payload
    }
  }, [preferences.stylePolicy]);

  useEffect(() => {
    if (!isAuthenticated) {
      setServerStateHydrated(true);
      return;
    }

    setServerStateHydrated(false);

    let cancelled = false;

    const loadServerState = async () => {
      try {
        const preferencePresets = await getUserReportPresets(ASSISTANT_PREFERENCES_SCOPE);
        const preferencePreset = preferencePresets.find((item) => item.presetName === ASSISTANT_PREFERENCES_PRESET) ?? preferencePresets[0] ?? null;
        if (preferencePreset?.presetJson && !cancelled) {
          const parsedPreferencePayload = JSON.parse(preferencePreset.presetJson) as {
            updatedAtUtc?: string;
            preferences?: Partial<AssistantPreferences>;
          } | Partial<AssistantPreferences>;

          if (typeof (parsedPreferencePayload as { updatedAtUtc?: string }).updatedAtUtc === 'string') {
            personalizationUpdatedUtcRef.current = (parsedPreferencePayload as { updatedAtUtc?: string }).updatedAtUtc ?? null;
          }

          const serverPreferences = (parsedPreferencePayload as { preferences?: Partial<AssistantPreferences> }).preferences
            ?? (parsedPreferencePayload as Partial<AssistantPreferences>);

          if (serverPreferences && typeof serverPreferences === 'object') {
            const normalizedServerPreferences = applyRestrictedPreferencePolicy(normalizePreferences(serverPreferences));
            personalizationLastSubmittedSignatureRef.current = buildPersonalizationSignature(normalizedServerPreferences);
          }

          if (serverPreferences && typeof serverPreferences === 'object') {
            const hasPersistedLocalPreferences = hasLocalPreferencesRef.current
              || localStorage.getItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY) === '1';

            if (!hasPersistedLocalPreferences) {
              setPreferences(applyRestrictedPreferencePolicy(normalizePreferences(serverPreferences)));
            }
          }
        }
      } catch {
        // fallback remains local storage
      } finally {
        if (!cancelled) {
          setServerStateHydrated(true);
        }
      }

      try {
        const presets = await getUserReportPresets(ASSISTANT_SCOPE);
        const preset = presets.find((item) => item.presetName === ASSISTANT_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as {
          sessions?: AssistantSession[];
          activeSessionId?: string | null;
          preferences?: Partial<AssistantPreferences>;
        };

        if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
          setSessions(parsed.sessions);
        }

        if (typeof parsed.activeSessionId === 'string' || parsed.activeSessionId === null) {
          setActiveSessionId(parsed.activeSessionId);
        }

        const hasPersistedLocalPreferences = hasLocalPreferencesRef.current
          || localStorage.getItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY) === '1';

        if (!hasPersistedLocalPreferences && parsed.preferences && typeof parsed.preferences === 'object') {
          setPreferences(applyRestrictedPreferencePolicy(normalizePreferences(parsed.preferences)));
        }
      } catch {
        // fallback remains local storage
      }

      try {
        const presets = await getUserReportPresets(ASSISTANT_ANALYTICS_SCOPE);
        const preset = presets.find((item) => item.presetName === ASSISTANT_ANALYTICS_PRESET) ?? presets[0] ?? null;
        if (!preset || !preset.presetJson || cancelled) {
          return;
        }

        const parsed = JSON.parse(preset.presetJson) as Partial<AssistantAnalyticsState>;
        setAnalytics({
          openCount: typeof parsed.openCount === 'number' ? Math.max(0, Math.round(parsed.openCount)) : 0,
          sessionCreatedCount: typeof parsed.sessionCreatedCount === 'number' ? Math.max(0, Math.round(parsed.sessionCreatedCount)) : 0,
          sessionRenamedCount: typeof parsed.sessionRenamedCount === 'number' ? Math.max(0, Math.round(parsed.sessionRenamedCount)) : 0,
          messageSentCount: typeof parsed.messageSentCount === 'number' ? Math.max(0, Math.round(parsed.messageSentCount)) : 0,
          lastOpenedAt: typeof parsed.lastOpenedAt === 'string' ? parsed.lastOpenedAt : null,
          lastMessageAt: typeof parsed.lastMessageAt === 'string' ? parsed.lastMessageAt : null,
        });
      } catch {
        // fallback remains local storage
      }
    };

    void loadServerState();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !ASSISTANT_AZURE_AI_ENABLED) {
      return;
    }

    let cancelled = false;

    const loadConversationHistory = async () => {
      try {
        const history = await getAgentConversationHistory();
        if (cancelled || history.length === 0) {
          return;
        }

        const normalized: AssistantSession[] = history.map((session) => ({
          ...session,
          messages: (session.messages ?? []).map((message) => ({
            id: message.id,
            role: (message.role === 'assistant' ? 'assistant' : 'user') as AgentMessage['role'],
            text: message.text,
            createdAt: message.createdAt,
            confidenceScore: message.role === 'assistant' ? 0.8 : null,
            citations: [],
            citationLinks: [],
            retrievalStatus: 'Grounded',
            approvalStatus: 'not-required',
            fallbackUsed: false,
          })),
        }));

        setSessions(normalized);
        setActiveSessionId((current) => current ?? normalized[0]?.id ?? null);
      } catch {
        // retain local + preset fallback
      }
    };

    void loadConversationHistory();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    sessionsRef.current = sessions;
    activeSessionIdRef.current = activeSessionId;
    preferencesRef.current = preferences;
    analyticsRef.current = analytics;
  }, [activeSessionId, analytics, preferences, sessions]);

  useEffect(() => {
    if (!localStateHydrated) {
      return;
    }

    try {
      localStorage.setItem(ASSISTANT_LOCAL_STATE_KEY, JSON.stringify({
        sessions,
        activeSessionId,
        preferences,
        analytics,
      }));
    } catch {
      // ignore oversized local state payloads; preferences are persisted separately below
    }

    if (hasLocalPreferencesRef.current || !isDefaultPreferences(preferences)) {
      try {
        localStorage.setItem(ASSISTANT_LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
      } catch {
        // ignore local preference persistence errors
      }

      hasLocalPreferencesRef.current = true;
      localStorage.setItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY, '1');
    } else {
      localStorage.removeItem(ASSISTANT_LOCAL_PREFERENCES_KEY);
      localStorage.removeItem(ASSISTANT_LOCAL_PREFERENCES_PRESENT_KEY);
    }

    persistGlobalStyleDefaults(preferences);
  }, [activeSessionId, analytics, localStateHydrated, preferences, sessions]);

  useEffect(() => {
    const flushOnUnload = () => {
      persistAssistantLocalStateNow();
    };

    window.addEventListener('beforeunload', flushOnUnload);
    return () => {
      window.removeEventListener('beforeunload', flushOnUnload);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !localStateHydrated || !serverStateHydrated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(ASSISTANT_SCOPE, {
        presetName: ASSISTANT_PRESET,
        presetJson: JSON.stringify({
          sessions,
          activeSessionId,
          preferences,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSessionId, isAuthenticated, localStateHydrated, policyLoadCompleted, preferences, serverStateHydrated, sessions]);

  useEffect(() => {
    if (!isAuthenticated || !localStateHydrated || !serverStateHydrated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(ASSISTANT_PREFERENCES_SCOPE, {
        presetName: ASSISTANT_PREFERENCES_PRESET,
        presetJson: JSON.stringify({
          updatedAtUtc: new Date().toISOString(),
          preferences,
        }),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, localStateHydrated, preferences, serverStateHydrated]);

  useEffect(() => {
    if (!isAuthenticated || !localStateHydrated || !serverStateHydrated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void upsertUserReportPreset(ASSISTANT_ANALYTICS_SCOPE, {
        presetName: ASSISTANT_ANALYTICS_PRESET,
        presetJson: JSON.stringify(analytics),
      }).catch(() => {
        // fallback remains local storage
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [analytics, isAuthenticated, localStateHydrated, serverStateHydrated]);

  useEffect(() => {
    if (!isAuthenticated || !ASSISTANT_AZURE_AI_ENABLED || !localStateHydrated || !serverStateHydrated) {
      return;
    }

    if (!personalizationUpdatedUtcRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const requestSignature = buildPersonalizationSignature(preferences);
      if (personalizationLastSubmittedSignatureRef.current === requestSignature) {
        return;
      }

      personalizationLastSubmittedSignatureRef.current = requestSignature;

      void saveAgentPersonalization({
        avatar: preferences.avatar,
        theme: preferences.theme,
        fontScale: preferences.fontScale,
        expectedUpdatedUtc: personalizationUpdatedUtcRef.current ?? undefined,
      })
        .then((result) => {
          if (typeof result.updatedUtc === 'string' && result.updatedUtc.length > 0) {
            personalizationUpdatedUtcRef.current = result.updatedUtc;
          }
        })
        .catch((error: unknown) => {
          if (error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AgentPersonalizationConflictError') {
            const currentUpdatedUtc = 'currentUpdatedUtc' in (error as Record<string, unknown>)
              ? (error as { currentUpdatedUtc?: string }).currentUpdatedUtc
              : undefined;

            if (typeof currentUpdatedUtc === 'string' && currentUpdatedUtc.length > 0) {
              personalizationUpdatedUtcRef.current = currentUpdatedUtc;
            }

            onNotify('Personalization updated in another session. Latest version was loaded for subsequent saves.', 'warning');
            personalizationLastSubmittedSignatureRef.current = null;
            return;
          }

          personalizationLastSubmittedSignatureRef.current = null;
          // local + preset fallback remains active
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, localStateHydrated, preferences, serverStateHydrated]);

  useEffect(() => {
    if (!isAuthenticated || !isAssistantAdmin || !ASSISTANT_AZURE_AI_ENABLED) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPolicySyncStatus('saving');
      const request: AgentPersonalizationPolicy = {
        showDiagnostics: preferences.showDiagnostics,
        requireApprovalForAll: preferences.requireApprovalForAll,
        lockGovernanceToggles: true,
        enforceGlobalStyle: preferences.stylePolicy === 'global',
        allowedThemes: ['auto', 'light', 'dark', 'midnight', 'violet'],
        allowedAvatars: ['copilot', 'radar', 'spark', 'shield', 'analyst', 'custom'],
        allowedFontScaleMin: 90,
        allowedFontScaleMax: 120,
        allowedAccentColors: ASSISTANT_COLOR_SWATCHES,
      };

      void saveAgentPersonalizationPolicy(request)
        .then(() => {
          setPolicySyncStatus('saved');
          if (showPersonalizationPanel) {
            loadPolicyHistory(1, policyHistory.pageSize);
          }
        })
        .catch(() => {
          setPolicySyncStatus('error');
        });
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAssistantAdmin, isAuthenticated, policyHistory.pageSize, preferences, showPersonalizationPanel]);

  const policyHistoryRows = useMemo(() => {
    const toDisplayValue = (value: string | number | boolean | string[] | null | undefined): string => {
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : 'none';
      }

      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }

      if (value === null || value === undefined) {
        return 'n/a';
      }

      return String(value);
    };

    const buildPolicyDeltaRows = (
      previousPolicy: AgentPersonalizationPolicy | undefined,
      updatedPolicy: AgentPersonalizationPolicy | undefined,
    ): Array<{ label: string; before: string; after: string }> => {
      if (!updatedPolicy) {
        return [];
      }

      const rows: Array<{ label: string; before: string; after: string }> = [];

      const appendIfChanged = (label: string, before: string | number | boolean | string[] | null | undefined, after: string | number | boolean | string[] | null | undefined) => {
        const beforeDisplay = toDisplayValue(before);
        const afterDisplay = toDisplayValue(after);
        if (beforeDisplay === afterDisplay) {
          return;
        }

        rows.push({
          label,
          before: beforeDisplay,
          after: afterDisplay,
        });
      };

      appendIfChanged('Show diagnostics', previousPolicy?.showDiagnostics, updatedPolicy.showDiagnostics);
      appendIfChanged('Require approval', previousPolicy?.requireApprovalForAll, updatedPolicy.requireApprovalForAll);
      appendIfChanged('Lock governance toggles', previousPolicy?.lockGovernanceToggles, updatedPolicy.lockGovernanceToggles);
      appendIfChanged('Enforce global style', previousPolicy?.enforceGlobalStyle, updatedPolicy.enforceGlobalStyle);
      appendIfChanged('Allowed themes', previousPolicy?.allowedThemes, updatedPolicy.allowedThemes);
      appendIfChanged('Allowed avatars', previousPolicy?.allowedAvatars, updatedPolicy.allowedAvatars);
      appendIfChanged('Font scale min', previousPolicy?.allowedFontScaleMin, updatedPolicy.allowedFontScaleMin);
      appendIfChanged('Font scale max', previousPolicy?.allowedFontScaleMax, updatedPolicy.allowedFontScaleMax);
      appendIfChanged('Allowed accent colors', previousPolicy?.allowedAccentColors, updatedPolicy.allowedAccentColors);

      return rows;
    };

    return policyHistory.items.map((item) => {
      let summary = 'Policy updated.';
      let detailRows: Array<{ label: string; before: string; after: string }> = [];

      if (item.detailJson) {
        try {
          const detail = JSON.parse(item.detailJson) as {
            previousPolicy?: AgentPersonalizationPolicy;
            updatedPolicy?: AgentPersonalizationPolicy;
          };

          detailRows = buildPolicyDeltaRows(detail.previousPolicy, detail.updatedPolicy);
          const updatedPolicy = detail.updatedPolicy;
          if (updatedPolicy) {
            const mode = updatedPolicy.enforceGlobalStyle ? 'global defaults' : 'user overrides';
            summary = `Themes: ${updatedPolicy.allowedThemes.join(', ')} · Mode: ${mode}`;
          }
        } catch {
          // keep default summary
        }
      }

      const actor = item.actorDisplayName?.trim() || (item.actorUserId ? `User ${item.actorUserId}` : 'Unknown');
      const eventAt = new Date(item.eventUtc).toLocaleString();

      return {
        id: item.auditEventId,
        actor,
        eventAt,
        outcome: item.outcomeCode,
        summary,
        details: detailRows,
      };
    });
  }, [policyHistory.items]);

  const canNavigatePolicyHistoryBackward = policyHistory.pageNumber > 1;
  const canNavigatePolicyHistoryForward = policyHistory.pageNumber * policyHistory.pageSize < policyHistory.totalCount;

  const loadPreviousPolicyHistoryPage = () => {
    if (!canNavigatePolicyHistoryBackward || policyHistoryLoadState === 'loading') {
      return;
    }

    loadPolicyHistory(policyHistory.pageNumber - 1, policyHistory.pageSize);
  };

  const loadNextPolicyHistoryPage = () => {
    if (!canNavigatePolicyHistoryForward || policyHistoryLoadState === 'loading') {
      return;
    }

    loadPolicyHistory(policyHistory.pageNumber + 1, policyHistory.pageSize);
  };

  const togglePolicyHistoryDetails = (entryId: number) => {
    setExpandedPolicyHistoryIds((current) => {
      if (current.includes(entryId)) {
        return current.filter((id) => id !== entryId);
      }

      return [...current, entryId];
    });
  };

  const expandAllPolicyHistoryDetails = () => {
    setExpandedPolicyHistoryIds(policyHistoryRows.map((entry) => entry.id));
  };

  const collapseAllPolicyHistoryDetails = () => {
    setExpandedPolicyHistoryIds([]);
  };

  const allPolicyHistoryDetailsExpanded = policyHistoryRows.length > 0
    && policyHistoryRows.every((entry) => expandedPolicyHistoryIds.includes(entry.id));

  useEffect(() => {
    if (policySyncStatus !== 'saved') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPolicySyncStatus('idle');
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [policySyncStatus]);

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null, [activeSessionId, sessions]);

  useEffect(() => {
    setSessionRenameText(activeSession?.title ?? '');
  }, [activeSession?.id, activeSession?.title]);

  const avatarIcon = useMemo(() => {
    if (preferences.avatar === 'radar') {
      return 'bi bi-broadcast-pin';
    }

    if (preferences.avatar === 'spark') {
      return 'bi bi-stars';
    }

    if (preferences.avatar === 'shield') {
      return 'bi bi-shield-check';
    }

    if (preferences.avatar === 'analyst') {
      return 'bi bi-person-badge';
    }

    return 'bi bi-robot';
  }, [preferences.avatar]);

  const agentAvatar = useMemo(() => {
    if (preferences.avatar === 'custom' && preferences.customAvatarDataUrl) {
      return (
        <img
          src={preferences.customAvatarDataUrl}
          alt="Assistant avatar"
          className="ipoc-agent-avatar-img"
        />
      );
    }

    return <i className={avatarIcon} aria-hidden="true" />;
  }, [avatarIcon, preferences.avatar, preferences.customAvatarDataUrl]);

  const dockThemeClass = useMemo(() => {
    if (preferences.theme === 'light') {
      return 'theme-light';
    }

    if (preferences.theme === 'dark') {
      return 'theme-dark';
    }

    if (preferences.theme === 'midnight') {
      return 'theme-midnight';
    }

    if (preferences.theme === 'violet') {
      return 'theme-violet';
    }

    return 'theme-auto';
  }, [preferences.theme]);

  const effectivePreferences = useMemo(() => {
    if (!policyState?.policy) {
      return preferences;
    }

    return mapPolicyToPreferences(policyState.policy, preferences);
  }, [policyState?.policy, preferences]);

  const policyDiffRows = useMemo(() => {
    if (!policyState?.policy) {
      return [] as Array<{ label: string; local: string; effective: string }>;
    }

    const rows: Array<{ label: string; local: string; effective: string }> = [];

    const appendIfDifferent = (label: string, localValue: string | number | boolean, effectiveValue: string | number | boolean) => {
      if (localValue === effectiveValue) {
        return;
      }

      rows.push({
        label,
        local: String(localValue),
        effective: String(effectiveValue),
      });
    };

    appendIfDifferent('Theme', preferences.theme, effectivePreferences.theme);
    appendIfDifferent('Avatar', preferences.avatar, effectivePreferences.avatar);
    appendIfDifferent('Font scale', `${preferences.fontScale}%`, `${effectivePreferences.fontScale}%`);
    appendIfDifferent('Accent color', preferences.accentColor, effectivePreferences.accentColor);
    appendIfDifferent('Show diagnostics', preferences.showDiagnostics, effectivePreferences.showDiagnostics);
    appendIfDifferent('Require approval', preferences.requireApprovalForAll, effectivePreferences.requireApprovalForAll);
    appendIfDifferent('Style policy', preferences.stylePolicy, effectivePreferences.stylePolicy);

    return rows;
  }, [effectivePreferences, policyState?.policy, preferences]);

  const applyQuickPrompt = (prompt: string) => {
    setComposerText(prompt);
    setShowEmojiPicker(false);
  };

  const appendEmojiToComposer = (emoji: string) => {
    setComposerText((current) => `${current}${emoji}`);
  };

  const addComposerAttachments = (files: File[]) => {
    const normalized = files
      .slice(0, 5)
      .map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      }));

    if (normalized.length === 0) {
      return;
    }

    setComposerAttachments((current) => {
      const merged = [...current, ...normalized]
        .filter((item, index, list) => list.findIndex((x) => x.name === item.name && x.size === item.size) === index)
        .slice(0, 8);
      return merged;
    });
  };

  const triggerAttachmentPicker = () => {
    fileInputRef.current?.click();
  };

  const onAttachmentSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    addComposerAttachments(files);
    event.target.value = '';
  };

  const removeAttachment = (fileName: string) => {
    setComposerAttachments((current) => current.filter((item) => item.name !== fileName));
  };

  const exportStyleProfile = () => {
    try {
      const payload: AssistantStyleProfile = {
        version: 1,
        exportedAtUtc: new Date().toISOString(),
        preferences,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `assistant-style-profile-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      onNotify('Assistant style profile exported.', 'info');
    } catch {
      onNotify('Unable to export assistant style profile.', 'warning');
    }
  };

  const triggerStyleProfileImport = () => {
    importProfileInputRef.current?.click();
  };

  const onStyleProfileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = typeof reader.result === 'string' ? reader.result : '{}';
        const parsed = JSON.parse(raw) as Partial<AssistantStyleProfile>;
        if (parsed.version !== 1 || !parsed.preferences) {
          onNotify('Invalid style profile format.', 'warning');
          return;
        }

        const normalized = normalizePreferences(parsed.preferences);
        const safeProfile = applyRestrictedPreferencePolicy(normalized);
        setPreferences((current) => ({
          ...safeProfile,
          showDiagnostics: governancePreferencesLocked ? current.showDiagnostics : safeProfile.showDiagnostics,
          requireApprovalForAll: governancePreferencesLocked ? current.requireApprovalForAll : safeProfile.requireApprovalForAll,
          stylePolicy: governancePreferencesLocked ? current.stylePolicy : safeProfile.stylePolicy,
        }));
        onNotify('Assistant style profile imported.', 'success');
      } catch {
        onNotify('Unable to import style profile.', 'warning');
      }
    };

    reader.readAsText(file);
    event.currentTarget.value = '';
  };

  const addSession = () => {
    const session = createDefaultSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setAnalytics((current) => ({
      ...current,
      sessionCreatedCount: current.sessionCreatedCount + 1,
    }));
    trackAnalyticsEvent('assistant_session_created', session.id);
    onNotify('Agent conversation session created.', 'info');
  };

  const removeSession = (sessionId: string) => {
    setSessions((current) => {
      const next = current.filter((session) => session.id !== sessionId);
      if (next.length === 0) {
        const fallback = createDefaultSession();
        setActiveSessionId(fallback.id);
        return [fallback];
      }

      if (sessionId === activeSessionId) {
        setActiveSessionId(next[0].id);
      }

      return next;
    });
  };

  const submitMessage = () => {
    const trimmed = composerText.trim();
    if (!trimmed || !activeSession) {
      return;
    }

    const now = new Date().toISOString();
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAt: now,
      confidenceScore: null,
      citations: [],
      approvalStatus: 'not-required',
      fallbackUsed: false,
    };

    const approvalStatus = preferences.requireApprovalForAll || requiresApproval(trimmed) ? 'pending' : 'not-required';

    setSessions((current) => current.map((session) => {
      if (session.id !== activeSession.id) {
        return session;
      }

      const title = session.messages.length <= 1 ? trimmed.slice(0, 48) : session.title;

      return {
        ...session,
        title,
        messages: [...session.messages, userMessage],
        updatedAt: now,
      };
    }));

    if (composerAttachments.length > 0) {
      setSessions((current) => current.map((session) => {
        if (session.id !== activeSession.id) {
          return session;
        }

        const nextMessages = [...session.messages];
        let lastUserIdx = -1;
        for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
          if (nextMessages[index].id === userMessage.id) {
            lastUserIdx = index;
            break;
          }
        }
        if (lastUserIdx >= 0) {
          nextMessages[lastUserIdx] = {
            ...nextMessages[lastUserIdx],
            attachments: composerAttachments,
          };
        }

        return {
          ...session,
          messages: nextMessages,
          updatedAt: now,
        };
      }));
    }

    setAnalytics((current) => ({
      ...current,
      messageSentCount: current.messageSentCount + 1,
      lastMessageAt: now,
    }));
    trackAnalyticsEvent('assistant_message_sent', activeSession.id, JSON.stringify({ promptLength: trimmed.length }));

    const planningMatch = trimmed.match(/\b(predict|forecast|demand|supply|shortfall|resource\s+pressure)\b/i);
    const incidentIdMatch = trimmed.match(/\bincident\s*#?\s*(\d+)\b/i);
    const horizonMatch = trimmed.match(/\b(\d{1,3})\s*(h|hr|hrs|hour|hours)\b/i);
    const inferredIncidentId = incidentIdMatch ? Number(incidentIdMatch[1]) : NaN;
    const inferredHorizonHours = horizonMatch ? Number(horizonMatch[1]) : 24;

    if (planningMatch && Number.isFinite(inferredIncidentId) && inferredIncidentId > 0 && isAuthenticated) {
      setIsAwaitingResponse(true);
      void getAgentPredictiveDemandSupply(inferredIncidentId, inferredHorizonHours)
        .then((response) => {
          const recommendationText = response.recommendations.length > 0
            ? response.recommendations.map((item, index) => `${index + 1}. ${item}`).join('\n')
            : 'No immediate recommendation generated.';
          const resourceGapText = response.shortageByResourceType.length > 0
            ? response.shortageByResourceType
              .slice(0, 3)
              .map((item) => `${item.resourceTypeCode}: gap ${item.predictedGapQuantity.toFixed(1)}`)
              .join('; ')
            : 'No projected resource-type gaps.';

          const assistantText = [
            `Predictive demand/supply (${response.modelId} ${response.modelVersion}) for incident ${response.incidentNumber} (${response.horizonHours}h horizon):`,
            `- Model trained: ${new Date(response.trainedAtUtc).toLocaleString()}`,
            `- Confidence interval: ${Math.round(response.confidenceInterval.lower * 100)}% - ${Math.round(response.confidenceInterval.upper * 100)}%`,
            `- Drift status: ${response.driftStatus}`,
            `- Risk level: ${response.riskLevel}`,
            `- Demand pressure index: ${response.demandPressureIndex}`,
            `- Supply readiness index: ${response.supplyReadinessIndex}`,
            `- Projected demand: ${response.projectedDemandQuantity.toFixed(1)} | projected supply: ${response.projectedSupplyQuantity.toFixed(1)} | shortfall: ${response.predictedShortfallQuantity.toFixed(1)}`,
            `- Top gaps: ${resourceGapText}`,
            'Recommendations:',
            recommendationText,
          ].join('\n');

          setSessions((current) => current.map((session) => {
            if (session.id !== activeSession.id) {
              return session;
            }

            return {
              ...session,
              messages: [
                ...session.messages,
                {
                  id: `assistant-${Date.now() + 1}`,
                  role: 'assistant',
                  text: assistantText,
                  createdAt: new Date().toISOString(),
                  confidenceScore: 0.72,
                  citations: [`Predictive model ${response.modelId} ${response.modelVersion}`],
                  citationLinks: [],
                  retrievalStatus: 'Grounded',
                  approvalStatus,
                  fallbackUsed: false,
                },
              ],
              updatedAt: new Date().toISOString(),
            };
          }));
        })
        .catch(() => {
          const fallbackAt = new Date().toISOString();
          setSessions((current) => current.map((session) => {
            if (session.id !== activeSession.id) {
              return session;
            }

            return {
              ...session,
              messages: [
                ...session.messages,
                {
                  id: `assistant-${Date.now() + 1}`,
                  role: 'assistant',
                  text: 'Predictive demand/supply insight could not be generated. Include a valid incident ID, for example: "predict demand for incident 125 over 48 hours".',
                  createdAt: fallbackAt,
                  confidenceScore: 0.4,
                  citations: [],
                  citationLinks: [],
                  retrievalStatus: 'Fallback',
                  approvalStatus: 'not-required',
                  fallbackUsed: true,
                },
              ],
              updatedAt: fallbackAt,
            };
          }));
        })
        .finally(() => {
          setIsAwaitingResponse(false);
        });
    } else if (ASSISTANT_AZURE_AI_ENABLED && isAuthenticated && azureConfigReady) {
      setIsAwaitingResponse(true);
      void completeAgentChat({
        sessionId: activeSession.id,
        prompt: trimmed,
        includeHistory: true,
      }).then((response) => {
        setSessions((current) => current.map((session) => {
          if (session.id !== activeSession.id) {
            return session;
          }

          return {
            ...session,
            messages: [
              ...session.messages,
              {
                id: response.message.id,
                role: response.message.role === 'assistant' ? 'assistant' : 'user',
                text: response.message.text,
                createdAt: response.message.createdAt,
                confidenceScore: response.confidenceScore,
                citations: response.groundedSources,
                citationLinks: (response.citations ?? []).map((item) => ({
                  label: item.label,
                  url: item.url,
                  sourceId: item.sourceId,
                  score: item.score,
                })),
                retrievalStatus: response.retrievalStatus,
                approvalStatus,
                fallbackUsed: response.fallbackUsed,
              },
            ],
            updatedAt: new Date().toISOString(),
          };
        }));
      }).catch(() => {
        const fallbackAt = new Date().toISOString();
        const fallbackText = azureConnectivityErrorSummary
          ? `I can’t reach Azure services right now. ${azureConnectivityErrorSummary}`
          : 'I’m having trouble reaching the knowledge service right now. Please try again in a moment.';

        setSessions((current) => current.map((session) => {
          if (session.id !== activeSession.id) {
            return session;
          }

          return {
            ...session,
            messages: [
              ...session.messages,
              {
                id: `assistant-${Date.now() + 1}`,
                role: 'assistant',
                text: fallbackText,
                createdAt: fallbackAt,
                confidenceScore: 0.42,
                citations: [],
                citationLinks: [],
                retrievalStatus: 'Fallback',
                approvalStatus: 'not-required',
                fallbackUsed: true,
              },
            ],
            updatedAt: fallbackAt,
          };
        }));
      }).finally(() => {
        setIsAwaitingResponse(false);
      });
    } else {
      const fallbackText = azureConnectivityErrorSummary
        ? `I can’t reach Azure services right now. ${azureConnectivityErrorSummary}`
        : 'I’m not fully configured for grounded responses yet. Please try again shortly.';

      const assistantMessage: AgentMessage = {
        id: `assistant-${Date.now() + 1}`,
        role: 'assistant',
        text: fallbackText,
        createdAt: now,
        confidenceScore: 0.5,
        citations: [],
        citationLinks: [],
        retrievalStatus: 'Fallback',
        approvalStatus: 'not-required',
        fallbackUsed: true,
      };

      setSessions((current) => current.map((session) => {
        if (session.id !== activeSession.id) {
          return session;
        }

        return {
          ...session,
          messages: [...session.messages, assistantMessage],
          updatedAt: now,
        };
      }));
      setIsAwaitingResponse(false);
    }

    setComposerText('');
    setComposerAttachments([]);
    setShowEmojiPicker(false);
  };

  const setMessageApprovalStatus = (messageId: string, status: 'approved' | 'rejected') => {
    if (!activeSession) {
      return;
    }

    setSessions((current) => current.map((session) => {
      if (session.id !== activeSession.id) {
        return session;
      }

      return {
        ...session,
        messages: session.messages.map((message) => {
          if (message.id !== messageId || message.role !== 'assistant') {
            return message;
          }

          return {
            ...message,
            approvalStatus: status,
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    }));

    trackAnalyticsEvent('assistant_message_approval_updated', activeSession.id, JSON.stringify({ messageId, status }));
    onNotify(
      status === 'approved'
        ? 'Assistant recommendation marked approved for operations review.'
        : 'Assistant recommendation marked rejected pending revision.',
      status === 'approved' ? 'success' : 'warning',
    );
  };

  const renameActiveSession = () => {
    if (!activeSession) {
      return;
    }

    const trimmed = sessionRenameText.trim();
    if (trimmed.length === 0 || trimmed === activeSession.title) {
      return;
    }

    const now = new Date().toISOString();
    setSessions((current) => current.map((session) => {
      if (session.id !== activeSession.id) {
        return session;
      }

      return {
        ...session,
        title: trimmed.slice(0, 72),
        updatedAt: now,
      };
    }));

    setAnalytics((current) => ({
      ...current,
      sessionRenamedCount: current.sessionRenamedCount + 1,
    }));
    trackAnalyticsEvent('assistant_session_renamed', activeSession.id);

    onNotify('Agent conversation renamed.', 'info');
  };

  const toggleAssistantDock = () => {
    setAssistantOpenedTracked(false);
    setIsOpen((current) => {
      const next = !current;
      if (!next) {
        persistAssistantLocalStateNow();
      }

      return next;
    });
  };

  const togglePersonalizationPanel = () => {
    setShowPersonalizationPanel((current) => {
      const next = !current;
      if (next) {
        setShowConversationsPanel(false);
        setShowQuickPromptsPanel(false);
        setShowEmojiPicker(false);
      }

      return next;
    });
  };

  const toggleConversationsPanel = () => {
    setShowConversationsPanel((current) => {
      const next = !current;
      if (next) {
        setShowPersonalizationPanel(false);
      }

      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      setShowEmojiPicker(false);
      setShowQuickPromptsPanel(false);
      setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;

    if (isOpen && !wasOpen) {
      const focusHandle = window.setTimeout(() => {
        composerInputRef.current?.focus();
      }, 0);

      wasOpenRef.current = isOpen;
      return () => {
        window.clearTimeout(focusHandle);
      };
    }

    if (!isOpen && wasOpen) {
      launcherButtonRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || showPersonalizationPanel) {
      return;
    }

    const stream = messageStreamRef.current;
    if (!stream) {
      return;
    }

    const frameHandle = window.requestAnimationFrame(() => {
      stream.scrollTo({
        top: stream.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameHandle);
    };
  }, [isAwaitingResponse, isOpen, showPersonalizationPanel, activeSession?.id, activeSession?.messages.length]);

  useEffect(() => {
    if (!isOpen || assistantOpenedTracked) {
      return;
    }

    const now = new Date().toISOString();
    setAnalytics((state) => ({
      ...state,
      openCount: state.openCount + 1,
      lastOpenedAt: now,
    }));
    trackAnalyticsEvent('assistant_opened', activeSession?.id ?? undefined);
    setAssistantOpenedTracked(true);
  }, [activeSession?.id, assistantOpenedTracked, isOpen]);

  const dockStyle = useMemo<CSSProperties>(() => ({
    '--ipoc-agent-accent': preferences.accentColor,
    '--ipoc-agent-assistant-bubble': preferences.assistantBubbleColor,
    '--ipoc-agent-user-bubble': preferences.userBubbleColor,
    '--ipoc-agent-shadow': `${preferences.shadowInset ? 'inset ' : ''}${preferences.shadowX}px ${preferences.shadowY}px ${preferences.shadowBlur}px ${preferences.shadowSpread}px ${preferences.shadowColor}`,
  } as CSSProperties), [preferences]);

  const recentPromptHistory = useMemo(() => sessions
    .flatMap((session) => session.messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.text.trim())
    .filter((text, index, list) => text.length > 0 && list.indexOf(text) === index)
    .slice(-8)
    .reverse(), [sessions]);

  return (
    <>
      <button
        ref={launcherButtonRef}
        type="button"
        className="ipoc-agent-launcher-btn"
        aria-label="Open AI Incident Co-Pilot"
        title="Open AI Incident Co-Pilot"
        onClick={toggleAssistantDock}
      >
        {agentAvatar}
      </button>

      <div
        className={`ipoc-agent-dock ${dockThemeClass} ${isOpen ? 'open' : 'closed'}`}
        style={dockStyle}
        role="dialog"
        aria-modal="false"
        aria-label="AI Incident Co-Pilot assistant"
      >
        <Card className="ipoc-agent-dock-card shadow-sm border-light-subtle">
          <Card.Header className="d-flex align-items-center justify-content-between py-2 ipoc-agent-header">
            <div className="d-flex align-items-center gap-2">
              <span className="ipoc-agent-avatar" aria-hidden="true">
                {agentAvatar}
              </span>
              <span>
                <span className="small fw-semibold d-block">AI Incident Co-Pilot</span>
                <span className="ipoc-agent-online-status-wrap">
                  <span className="ipoc-agent-online-status">We&apos;re online</span>
                  <span
                    className={`ipoc-agent-status-dot ${connectionStatus.className}`}
                    title={connectionStatus.label}
                    aria-label={connectionStatus.label}
                  />
                </span>
              </span>
            </div>
            <span className="d-inline-flex gap-1 align-items-center">
              <IconActionButton
                iconClassName="bi bi-sliders2"
                tooltip={showPersonalizationPanel ? 'Hide personalization' : 'Show personalization'}
                ariaLabel={showPersonalizationPanel ? 'Hide personalization' : 'Show personalization'}
                onClick={togglePersonalizationPanel}
                variant={showPersonalizationPanel ? 'secondary' : 'outline-secondary'}
                size="sm"
                aria-expanded={showPersonalizationPanel}
                aria-controls="assistant-personalization-panel"
              />
              <IconActionButton
                iconClassName="bi bi-chat-left-text"
                tooltip={showConversationsPanel ? 'Hide conversations' : 'Show conversations'}
                ariaLabel={showConversationsPanel ? 'Hide conversations' : 'Show conversations'}
                onClick={toggleConversationsPanel}
                variant={showConversationsPanel ? 'secondary' : 'outline-secondary'}
                size="sm"
                aria-expanded={showConversationsPanel}
                aria-controls="assistant-conversations-panel"
              />
              <IconActionButton
                iconClassName="bi bi-x-lg"
                tooltip="Collapse assistant"
                ariaLabel="Collapse assistant"
                onClick={() => setIsOpen(false)}
                variant="outline-secondary"
                size="sm"
              />
            </span>
          </Card.Header>
          <Card.Body className="py-2">
            {preferences.showDiagnostics && azureConnectivityErrorSummary && (
              <div className="small text-danger mb-2 ipoc-agent-connectivity-alert">
                {azureConnectivityErrorSummary}
              </div>
            )}

            {showPersonalizationPanel && (
              <div id="assistant-personalization-panel" className="ipoc-agent-panel ipoc-agent-panel-personalization ipoc-agent-panel-personalization-full mb-2">
                <div className="small fw-semibold mb-2">Personalization</div>
                <div className="row g-2">
                  <div className="col-4">
                    <Form.Select
                      size="sm"
                      value={preferences.avatar}
                      aria-label="Assistant avatar"
                      onChange={(event) => setPreferences((current) => ({
                        ...current,
                        avatar: event.target.value as AssistantPreferences['avatar'],
                      }))}
                    >
                      <option value="copilot">Copilot</option>
                      <option value="radar">Radar</option>
                      <option value="spark">Spark</option>
                      <option value="shield">Shield</option>
                      <option value="analyst">Analyst</option>
                      <option value="custom">Custom</option>
                    </Form.Select>
                  </div>
                  <div className="col-4">
                    <Form.Select
                      size="sm"
                      value={preferences.theme}
                      aria-label="Assistant theme"
                      onChange={(event) => setPreferences((current) => ({
                        ...current,
                        theme: event.target.value as AssistantPreferences['theme'],
                      }))}
                    >
                      <option value="auto">Theme Auto</option>
                      <option value="light">Theme Light</option>
                      <option value="dark">Theme Dark</option>
                      <option value="midnight">Theme Midnight</option>
                      <option value="violet">Theme Violet</option>
                    </Form.Select>
                  </div>
                  <div className="col-4">
                    <Form.Select
                      size="sm"
                      value={preferences.fontScale}
                      aria-label="Assistant font scale"
                      onChange={(event) => setPreferences((current) => ({
                        ...current,
                        fontScale: Number(event.target.value),
                      }))}
                    >
                      <option value={90}>Font 90%</option>
                      <option value={100}>Font 100%</option>
                      <option value={110}>Font 110%</option>
                      <option value={120}>Font 120%</option>
                    </Form.Select>
                  </div>
                  {preferences.avatar === 'custom' && (
                    <div className="col-12">
                      <Form.Control
                        size="sm"
                        type="file"
                        accept="image/*"
                        aria-label="Upload custom assistant avatar"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          const file = event.currentTarget.files?.[0];
                          if (!file) {
                            return;
                          }

                          const reader = new FileReader();
                          reader.onload = () => {
                            const value = typeof reader.result === 'string' ? reader.result : null;
                            setPreferences((current) => ({
                              ...current,
                              customAvatarDataUrl: value,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
                  )}

                  <div className="col-12">
                    <div className="small fw-semibold mt-1">Accent color</div>
                    <div className="ipoc-agent-color-swatches mt-1">
                      {ASSISTANT_COLOR_SWATCHES.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          className={`ipoc-agent-color-swatch ${preferences.accentColor.toLowerCase() === swatch.toLowerCase() ? 'active' : ''}`}
                          style={{ backgroundColor: swatch }}
                          aria-label={`Set accent color ${swatch}`}
                          title={`Set accent color ${swatch}`}
                          onClick={() => setPreferences((current) => ({ ...current, accentColor: swatch }))}
                        />
                      ))}
                      <Form.Control
                        size="sm"
                        type="color"
                        aria-label="Custom accent color"
                        value={preferences.accentColor}
                        onChange={(event) => setPreferences((current) => ({ ...current, accentColor: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="col-6">
                    <Form.Label className="small mb-1"><LabelWithInfo text="Bot bubble" info="Set the message bubble color used for assistant responses in conversation history." /></Form.Label>
                    <Form.Control
                      size="sm"
                      type="color"
                      value={preferences.assistantBubbleColor}
                      onChange={(event) => setPreferences((current) => ({ ...current, assistantBubbleColor: event.target.value }))}
                    />
                  </div>
                  <div className="col-6">
                    <Form.Label className="small mb-1"><LabelWithInfo text="User bubble" info="Set the message bubble color used for operator/user messages." /></Form.Label>
                    <Form.Control
                      size="sm"
                      type="color"
                      value={preferences.userBubbleColor}
                      onChange={(event) => setPreferences((current) => ({ ...current, userBubbleColor: event.target.value }))}
                    />
                  </div>

                  <div className="col-12">
                    <div className="small fw-semibold mt-1">Shadow</div>
                  </div>
                  <div className="col-6">
                    <Form.Label className="small mb-1"><LabelWithInfo text={`Horizontal (${preferences.shadowX}px)`} info="Adjust horizontal offset of the dock shadow effect in pixels." /></Form.Label>
                    <Form.Range
                      value={preferences.shadowX}
                      min={-32}
                      max={32}
                      onChange={(event) => setPreferences((current) => ({ ...current, shadowX: Number(event.target.value) }))}
                    />
                  </div>
                  <div className="col-6">
                    <Form.Label className="small mb-1"><LabelWithInfo text={`Vertical (${preferences.shadowY}px)`} info="Adjust vertical offset of the dock shadow effect in pixels." /></Form.Label>
                    <Form.Range
                      value={preferences.shadowY}
                      min={-32}
                      max={32}
                      onChange={(event) => setPreferences((current) => ({ ...current, shadowY: Number(event.target.value) }))}
                    />
                  </div>
                  <div className="col-6">
                    <Form.Label className="small mb-1"><LabelWithInfo text={`Blur (${preferences.shadowBlur}px)`} info="Adjust softness of the dock shadow edge using blur radius in pixels." /></Form.Label>
                    <Form.Range
                      value={preferences.shadowBlur}
                      min={0}
                      max={64}
                      onChange={(event) => setPreferences((current) => ({ ...current, shadowBlur: Number(event.target.value) }))}
                    />
                  </div>
                  <div className="col-6">
                    <Form.Label className="small mb-1"><LabelWithInfo text={`Spread (${preferences.shadowSpread}px)`} info="Expand or contract shadow footprint around the dock using spread radius in pixels." /></Form.Label>
                    <Form.Range
                      value={preferences.shadowSpread}
                      min={-24}
                      max={24}
                      onChange={(event) => setPreferences((current) => ({ ...current, shadowSpread: Number(event.target.value) }))}
                    />
                  </div>
                  <div className="col-6">
                    <Form.Label className="small mb-1"><LabelWithInfo text="Shadow color" info="Set color used for assistant dock shadow styling." /></Form.Label>
                    <Form.Control
                      size="sm"
                      type="color"
                      value={preferences.shadowColor}
                      onChange={(event) => setPreferences((current) => ({ ...current, shadowColor: event.target.value }))}
                    />
                  </div>
                  <div className="col-6 d-flex align-items-end">
                    <Form.Check
                      id="assistant-shadow-inset"
                      label="Inset shadow"
                      checked={preferences.shadowInset}
                      onChange={(event) => setPreferences((current) => ({ ...current, shadowInset: event.target.checked }))}
                    />
                  </div>

                  <div className="col-12">
                    <div className="small fw-semibold mt-1">Administration</div>
                    <Form.Check
                      id="assistant-style-policy-global"
                      type="switch"
                      label={preferences.stylePolicy === 'global' ? 'Style policy: Global defaults' : 'Style policy: User overrides'}
                      checked={preferences.stylePolicy === 'global'}
                      disabled={governancePreferencesLocked}
                      onChange={(event) => setPreferences((current) => ({
                        ...current,
                        stylePolicy: event.target.checked ? 'global' : 'user',
                      }))}
                    />
                    <Form.Check
                      id="assistant-show-diagnostics"
                      label="Show connectivity diagnostics"
                      checked={preferences.showDiagnostics}
                      disabled={governancePreferencesLocked}
                      onChange={(event) => setPreferences((current) => ({ ...current, showDiagnostics: event.target.checked }))}
                    />
                    <Form.Check
                      id="assistant-require-approval-all"
                      label="Require approval checkpoint for all assistant responses"
                      checked={preferences.requireApprovalForAll}
                      disabled={governancePreferencesLocked}
                      onChange={(event) => setPreferences((current) => ({ ...current, requireApprovalForAll: event.target.checked }))}
                    />
                    {governancePreferencesLocked && (
                      <div className="small text-muted mt-1">
                        Governance controls are locked to administrator roles.
                      </div>
                    )}

                    <div className="small text-muted mt-1">
                      {policySyncStatus === 'saving' && 'Saving policy to server...'}
                      {policySyncStatus === 'saved' && 'Policy synced to server.'}
                      {policySyncStatus === 'error' && 'Policy sync failed. Local settings remain active.'}
                      {policySyncStatus === 'idle' && policyState?.hasGlobalPolicy && 'Global policy is active.'}
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="small fw-semibold mt-1">Policy inspector</div>
                    <div className="small text-muted">
                      Manage permission: {policyState?.canManagePolicy ? 'Yes' : 'No'}
                      {' · '}
                      Global policy: {policyState?.hasGlobalPolicy ? 'Enabled' : 'Not set'}
                    </div>
                    {policyState?.policy && (
                      <div className="small text-muted">
                        Themes: {policyState.policy.allowedThemes.join(', ')}
                        {' · '}
                        Avatars: {policyState.policy.allowedAvatars.join(', ')}
                        {' · '}
                        Font range: {policyState.policy.allowedFontScaleMin}%–{policyState.policy.allowedFontScaleMax}%
                      </div>
                    )}

                    {policyDiffRows.length > 0 ? (
                      <div className="small mt-1 ipoc-agent-policy-diff">
                        <div className="fw-semibold">Effective policy vs local overrides</div>
                        <ul className="mb-0 mt-1 ps-3">
                          {policyDiffRows.map((row) => (
                            <li key={row.label}>
                              {row.label}: local <code>{row.local}</code> → effective <code>{row.effective}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="small text-muted mt-1">No policy overrides are currently applied.</div>
                    )}

                    <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
                      <div className="small fw-semibold">Policy change history</div>
                      {policyHistoryRows.length > 0 && (
                        <IconActionButton
                          iconClassName={allPolicyHistoryDetailsExpanded ? 'bi bi-arrows-collapse' : 'bi bi-arrows-expand'}
                          tooltip={allPolicyHistoryDetailsExpanded ? 'Collapse all policy history details' : 'Expand all policy history details'}
                          ariaLabel={allPolicyHistoryDetailsExpanded ? 'Collapse all policy history details' : 'Expand all policy history details'}
                          onClick={allPolicyHistoryDetailsExpanded ? collapseAllPolicyHistoryDetails : expandAllPolicyHistoryDetails}
                          variant="outline-secondary"
                          size="sm"
                        />
                      )}
                    </div>
                    {policyHistoryLoadState === 'loading' && (
                      <div className="small text-muted mt-1">Loading policy history…</div>
                    )}
                    {policyHistoryLoadState === 'error' && (
                      <div className="small text-muted mt-1">Unable to load policy history.</div>
                    )}
                    {policyHistoryLoadState !== 'loading' && policyHistoryRows.length === 0 && (
                      <div className="small text-muted mt-1">No policy changes recorded yet.</div>
                    )}
                    {policyHistoryRows.length > 0 && (
                      <>
                        <div className="d-flex align-items-center justify-content-between mt-1 small text-muted">
                          <span>
                            Showing {(policyHistory.pageNumber - 1) * policyHistory.pageSize + 1}
                            –
                            {Math.min(policyHistory.pageNumber * policyHistory.pageSize, policyHistory.totalCount)}
                            {' '}of {policyHistory.totalCount}
                          </span>
                          <div className="d-flex gap-1">
                            <IconActionButton
                              iconClassName="bi bi-chevron-left"
                              tooltip="Previous policy history page"
                              ariaLabel="Previous policy history page"
                              onClick={loadPreviousPolicyHistoryPage}
                              variant="outline-secondary"
                              size="sm"
                              disabled={!canNavigatePolicyHistoryBackward || policyHistoryLoadState === 'loading'}
                            />
                            <IconActionButton
                              iconClassName="bi bi-chevron-right"
                              tooltip="Next policy history page"
                              ariaLabel="Next policy history page"
                              onClick={loadNextPolicyHistoryPage}
                              variant="outline-secondary"
                              size="sm"
                              disabled={!canNavigatePolicyHistoryForward || policyHistoryLoadState === 'loading'}
                            />
                          </div>
                        </div>

                        <ul className="list-unstyled small mt-1 mb-0 ipoc-agent-policy-history">
                          {policyHistoryRows.map((entry) => (
                            <li key={entry.id} className="ipoc-agent-policy-history-item">
                              <div className="d-flex align-items-center justify-content-between gap-2">
                                <div className="fw-semibold">{entry.actor} · {entry.eventAt}</div>
                                <IconActionButton
                                  iconClassName={expandedPolicyHistoryIds.includes(entry.id) ? 'bi bi-eye-slash' : 'bi bi-eye'}
                                  tooltip={expandedPolicyHistoryIds.includes(entry.id) ? 'Hide policy history details' : 'View policy history details'}
                                  ariaLabel={expandedPolicyHistoryIds.includes(entry.id) ? 'Hide policy history details' : 'View policy history details'}
                                  onClick={() => togglePolicyHistoryDetails(entry.id)}
                                  variant="outline-secondary"
                                  size="sm"
                                  ariaExpanded={expandedPolicyHistoryIds.includes(entry.id)}
                                  ariaControls={`policy-history-details-${entry.id}`}
                                />
                              </div>
                              <div className="text-muted">{entry.summary}</div>
                              {expandedPolicyHistoryIds.includes(entry.id) && (
                                <div id={`policy-history-details-${entry.id}`} className="ipoc-agent-policy-history-details mt-1">
                                  {entry.details.length > 0 ? (
                                    <ul className="mb-0 mt-1 ps-3">
                                      {entry.details.map((detail) => (
                                        <li key={`${entry.id}-${detail.label}`}>
                                          {detail.label}: <code>{detail.before}</code> → <code>{detail.after}</code>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="small text-muted">Detailed payload unavailable for this event.</div>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div className="col-12">
                    <div className="small fw-semibold mt-1">Style profile</div>
                    <div className="d-flex gap-2 flex-wrap">
                      <IconActionButton
                        iconClassName="bi bi-download"
                        tooltip="Export assistant style profile"
                        ariaLabel="Export assistant style profile"
                        onClick={exportStyleProfile}
                        variant="outline-secondary"
                        size="sm"
                      />
                      <IconActionButton
                        iconClassName="bi bi-upload"
                        tooltip="Import assistant style profile"
                        ariaLabel="Import assistant style profile"
                        onClick={triggerStyleProfileImport}
                        variant="outline-secondary"
                        size="sm"
                      />
                      <IconActionButton
                        iconClassName="bi bi-arrow-counterclockwise"
                        tooltip="Reset assistant style to defaults"
                        ariaLabel="Reset assistant style to defaults"
                        onClick={() => setPreferences((current) => ({
                          ...normalizePreferences(defaultPreferences),
                          showDiagnostics: governancePreferencesLocked ? current.showDiagnostics : defaultPreferences.showDiagnostics,
                          requireApprovalForAll: governancePreferencesLocked ? current.requireApprovalForAll : defaultPreferences.requireApprovalForAll,
                          stylePolicy: governancePreferencesLocked ? current.stylePolicy : defaultPreferences.stylePolicy,
                        }))}
                        variant="outline-secondary"
                        size="sm"
                      />
                    </div>
                    <input
                      ref={importProfileInputRef}
                      type="file"
                      className="d-none"
                      accept="application/json"
                      onChange={onStyleProfileSelected}
                    />
                  </div>
                </div>
              </div>
            )}

            {!showPersonalizationPanel && showConversationsPanel && (
              <div id="assistant-conversations-panel" className="ipoc-agent-panel mb-2">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="small fw-semibold">Conversations</div>
                  <IconActionButton
                    iconClassName="bi bi-plus-circle"
                    tooltip="New conversation"
                    ariaLabel="Create new conversation"
                    onClick={addSession}
                    variant="outline-secondary"
                    size="sm"
                  />
                </div>

                <div className="d-flex gap-2 align-items-center mb-2">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={sessionRenameText}
                    placeholder="Rename active conversation"
                    aria-label="Rename active conversation"
                    onChange={(event) => setSessionRenameText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        renameActiveSession();
                      }
                    }}
                    disabled={!activeSession}
                  />
                  <IconActionButton
                    iconClassName="bi bi-pencil-square"
                    tooltip="Rename active conversation"
                    ariaLabel="Rename active conversation"
                    onClick={renameActiveSession}
                    variant="outline-secondary"
                    size="sm"
                    disabled={!activeSession || sessionRenameText.trim().length === 0}
                  />
                </div>

                <ListGroup variant="flush" className="ipoc-agent-session-list mb-1">
                  {sessions.map((session) => (
                    <ListGroup.Item key={session.id} className={`px-0 py-1 small d-flex align-items-center justify-content-between ${session.id === activeSession?.id ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-start text-decoration-none"
                        title={`Switch to conversation ${session.title}`}
                        onClick={() => setActiveSessionId(session.id)}
                      >
                        {session.title}
                      </button>
                      <IconActionButton
                        iconClassName="bi bi-trash"
                        tooltip="Delete conversation"
                        ariaLabel="Delete conversation"
                        onClick={() => removeSession(session.id)}
                        variant="outline-secondary"
                        size="sm"
                      />
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            )}

            {!showPersonalizationPanel && (
              <>
                <div
                  ref={messageStreamRef}
                  className="ipoc-agent-message-stream"
                  style={{
                    fontSize: `${preferences.fontScale}%`,
                    minHeight: showConversationsPanel ? '10rem' : '18rem',
                  }}
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions text"
                  aria-label="Assistant conversation messages"
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const files = Array.from(event.dataTransfer?.files ?? []);
                    if (files.length > 0) {
                      addComposerAttachments(files);
                    }
                  }}
                >
                  {activeSession?.messages.map((message) => (
                    <div key={message.id} className={`ipoc-agent-message ${message.role}`}>
                  <div className="small fw-semibold mb-1 d-flex align-items-center justify-content-between gap-2">
                    <span className="d-inline-flex align-items-center gap-1">
                      <span className={`ipoc-agent-message-avatar ${message.role === 'assistant' ? 'assistant' : 'user'}`}>
                        {message.role === 'assistant' ? agentAvatar : <i className="bi bi-person-circle" aria-hidden="true" />}
                      </span>
                      <span>{message.role === 'assistant' ? 'Agent' : 'You'}</span>
                    </span>
                    {message.role === 'assistant' && !message.fallbackUsed && (
                      <span className="d-inline-flex align-items-center gap-1">
                        {typeof message.confidenceScore === 'number' && (
                          <Badge bg={message.confidenceScore >= 0.75 ? 'success' : message.confidenceScore >= 0.55 ? 'warning' : 'secondary'}>
                            Confidence {Math.round(message.confidenceScore * 100)}%
                          </Badge>
                        )}
                        {message.retrievalStatus && !message.fallbackUsed && (
                          <Badge bg={message.retrievalStatus === 'Grounded' ? 'info' : 'secondary'}>
                            {message.retrievalStatus}
                          </Badge>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="ipoc-agent-attachment-list mt-1">
                      {message.attachments.map((attachment) => (
                        <span key={`${message.id}-${attachment.name}`} className="ipoc-agent-attachment-pill">
                          <i className="bi bi-paperclip" aria-hidden="true" /> {attachment.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                    <div className="small text-muted mt-1">
                      Citations: {message.citations.join(' • ')}
                    </div>
                  )}
                  {message.role === 'assistant' && message.citationLinks && message.citationLinks.length > 0 && (
                    <div className="small text-muted mt-1">
                      Evidence:
                      <ul className="mb-0 mt-1 ps-3">
                        {message.citationLinks.map((citation, index) => (
                          <li key={`${message.id}-citation-${index}`}>
                            {citation.url ? (
                              <a href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a>
                            ) : citation.label}
                            {typeof citation.score === 'number' && ` (score ${citation.score.toFixed(3)})`}
                            {!citation.url && citation.sourceId ? ` [${citation.sourceId}]` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {message.role === 'assistant' && message.approvalStatus === 'pending' && (
                    <div className="d-flex gap-2 mt-2">
                      <IconActionButton
                        iconClassName="bi bi-check-circle"
                        tooltip="Approve assistant response for human-reviewed use"
                        ariaLabel="Approve assistant response"
                        onClick={() => setMessageApprovalStatus(message.id, 'approved')}
                        variant="outline-success"
                        size="sm"
                      />
                      <IconActionButton
                        iconClassName="bi bi-x-circle"
                        tooltip="Reject assistant response pending revision"
                        ariaLabel="Reject assistant response"
                        onClick={() => setMessageApprovalStatus(message.id, 'rejected')}
                        variant="outline-warning"
                        size="sm"
                      />
                    </div>
                  )}
                  {message.role === 'assistant' && message.approvalStatus && message.approvalStatus !== 'pending' && message.approvalStatus !== 'not-required' && (
                    <div className="small text-muted mt-1">
                      Approval checkpoint: {message.approvalStatus === 'approved' ? 'Approved for human-reviewed use' : 'Rejected pending revision'}
                    </div>
                  )}
                    </div>
                  ))}
                  {isAwaitingResponse && (
                    <div className="ipoc-agent-message assistant ipoc-agent-typing">
                      <div className="small fw-semibold mb-1">Agent</div>
                      <div className="ipoc-agent-typing-dots" role="status" aria-live="polite" aria-label="Assistant is typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                </div>

                {preferences.showDiagnostics && (
                  <div className="small text-muted mt-2">
                  Sessions created: {analytics.sessionCreatedCount} · Renamed: {analytics.sessionRenamedCount} · Messages sent: {analytics.messageSentCount}
                  </div>
                )}

                <div className="ipoc-agent-quick-prompts-accordion mt-2">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="small fw-semibold">Quick prompts</span>
                    <IconActionButton
                      iconClassName={showQuickPromptsPanel ? 'bi bi-chevron-up' : 'bi bi-chevron-down'}
                      tooltip={showQuickPromptsPanel ? 'Hide quick prompts' : 'Show quick prompts'}
                      ariaLabel={showQuickPromptsPanel ? 'Hide quick prompts' : 'Show quick prompts'}
                      onClick={() => setShowQuickPromptsPanel((current) => !current)}
                      variant="outline-secondary"
                      size="sm"
                      ariaExpanded={showQuickPromptsPanel}
                      ariaControls="assistant-quick-prompts-panel"
                    />
                  </div>

                  {showQuickPromptsPanel && (
                    <div id="assistant-quick-prompts-panel" className="ipoc-agent-quick-prompts mt-2">
                      {ASSISTANT_QUICK_PROMPTS.map((quickPrompt) => (
                        <div key={quickPrompt} className="d-flex align-items-center gap-2">
                          <IconActionButton
                            iconClassName="bi bi-lightning"
                            tooltip={`Apply quick prompt: ${quickPrompt}`}
                            ariaLabel={`Apply quick prompt: ${quickPrompt}`}
                            onClick={() => applyQuickPrompt(quickPrompt)}
                            variant="outline-primary"
                            size="sm"
                          />
                          <span className="small text-muted">{quickPrompt}</span>
                        </div>
                      ))}

                      {recentPromptHistory.map((prompt, index) => (
                        <div key={`history-${index}`} className="d-flex align-items-center gap-2">
                          <IconActionButton
                            iconClassName="bi bi-clock-history"
                            tooltip="Apply recent prompt"
                            ariaLabel="Apply recent prompt"
                            onClick={() => applyQuickPrompt(prompt)}
                            variant="outline-secondary"
                            size="sm"
                          />
                          <span className="small text-muted">{prompt.length > 88 ? `${prompt.slice(0, 88)}…` : prompt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {composerAttachments.length > 0 && (
                  <div className="ipoc-agent-attachment-list mt-2">
                    {composerAttachments.map((attachment) => (
                      <div key={attachment.name} className="d-flex align-items-center gap-2">
                        <span className="ipoc-agent-attachment-pill">
                          <i className="bi bi-paperclip" aria-hidden="true" /> {attachment.name}
                        </span>
                        <IconActionButton
                          iconClassName="bi bi-x"
                          tooltip={`Remove attachment ${attachment.name}`}
                          ariaLabel={`Remove attachment ${attachment.name}`}
                          onClick={() => removeAttachment(attachment.name)}
                          variant="outline-secondary"
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="d-flex gap-2 mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="d-none"
                    multiple
                    onChange={onAttachmentSelected}
                  />
                  <IconActionButton
                    iconClassName="bi bi-paperclip"
                    tooltip="Attach files"
                    ariaLabel="Attach files"
                    onClick={triggerAttachmentPicker}
                    variant="outline-secondary"
                    size="sm"
                  />
                  <IconActionButton
                    iconClassName="bi bi-emoji-smile"
                    tooltip={showEmojiPicker ? 'Hide emoji picker' : 'Show emoji picker'}
                    ariaLabel={showEmojiPicker ? 'Hide emoji picker' : 'Show emoji picker'}
                    onClick={() => setShowEmojiPicker((current) => !current)}
                    variant={showEmojiPicker ? 'secondary' : 'outline-secondary'}
                    size="sm"
                  />
                  <Form.Control
                    ref={composerInputRef}
                    size="sm"
                    type="text"
                    value={composerText}
                    placeholder="Ask AI Incident Co-Pilot"
                    aria-label="AI assistant prompt"
                    onChange={(event) => setComposerText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitMessage();
                      }
                    }}
                  />
                  <IconActionButton
                    iconClassName="bi bi-send"
                    tooltip="Send message"
                    ariaLabel="Send message"
                    onClick={submitMessage}
                    variant="outline-secondary"
                    size="sm"
                    disabled={composerText.trim().length === 0}
                  />
                </div>
                {showEmojiPicker && (
                  <div className="ipoc-agent-emoji-row mt-2">
                    {ASSISTANT_EMOJI_OPTIONS.map((emoji) => (
                      <IconActionButton
                        key={emoji}
                        iconClassName="bi bi-emoji-smile"
                        tooltip={`Insert emoji ${emoji}`}
                        ariaLabel={`Insert emoji ${emoji}`}
                        onClick={() => appendEmojiToComposer(emoji)}
                        variant="outline-secondary"
                        size="sm"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Card.Body>
        </Card>
      </div>
    </>
  );
}

export default AssistantDock;
