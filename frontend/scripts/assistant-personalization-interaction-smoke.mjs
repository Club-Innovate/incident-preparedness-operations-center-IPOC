import assert from 'node:assert/strict';

const defaultPreferences = {
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

function normalizePreferences(input = {}) {
  return {
    avatar: ['copilot', 'radar', 'spark', 'shield', 'analyst', 'custom'].includes(input.avatar) ? input.avatar : defaultPreferences.avatar,
    theme: ['auto', 'light', 'dark', 'midnight', 'violet'].includes(input.theme) ? input.theme : defaultPreferences.theme,
    fontScale: typeof input.fontScale === 'number' ? Math.max(90, Math.min(120, Math.round(input.fontScale))) : defaultPreferences.fontScale,
    customAvatarDataUrl: typeof input.customAvatarDataUrl === 'string' ? input.customAvatarDataUrl : null,
    accentColor: typeof input.accentColor === 'string' ? input.accentColor : defaultPreferences.accentColor,
    assistantBubbleColor: typeof input.assistantBubbleColor === 'string' ? input.assistantBubbleColor : defaultPreferences.assistantBubbleColor,
    userBubbleColor: typeof input.userBubbleColor === 'string' ? input.userBubbleColor : defaultPreferences.userBubbleColor,
    shadowX: typeof input.shadowX === 'number' ? Math.max(-32, Math.min(32, Math.round(input.shadowX))) : defaultPreferences.shadowX,
    shadowY: typeof input.shadowY === 'number' ? Math.max(-32, Math.min(32, Math.round(input.shadowY))) : defaultPreferences.shadowY,
    shadowBlur: typeof input.shadowBlur === 'number' ? Math.max(0, Math.min(64, Math.round(input.shadowBlur))) : defaultPreferences.shadowBlur,
    shadowSpread: typeof input.shadowSpread === 'number' ? Math.max(-24, Math.min(24, Math.round(input.shadowSpread))) : defaultPreferences.shadowSpread,
    shadowColor: typeof input.shadowColor === 'string' ? input.shadowColor : defaultPreferences.shadowColor,
    shadowInset: input.shadowInset === true,
    showDiagnostics: input.showDiagnostics === true,
    requireApprovalForAll: input.requireApprovalForAll === true,
    stylePolicy: input.stylePolicy === 'global' ? 'global' : 'user',
  };
}

function isDefaultPreferences(input) {
  const normalized = normalizePreferences(input);
  return Object.keys(defaultPreferences).every((key) => normalized[key] === defaultPreferences[key]);
}

function shouldAdoptServerPreferences({ hasLocalPreferencesMarker, serverPreferences }) {
  if (!serverPreferences || typeof serverPreferences !== 'object') {
    return false;
  }

  return !hasLocalPreferencesMarker;
}

function shouldPersistRemote({ isAuthenticated, localStateHydrated, serverStateHydrated }) {
  return isAuthenticated && localStateHydrated && serverStateHydrated;
}

function shouldMarkLocalPreferencesPresent(currentPreferences, localMarkerAlreadySet) {
  return localMarkerAlreadySet || !isDefaultPreferences(currentPreferences);
}

function runAssistantPersonalizationInteractionSmoke() {
  const serverPayload = {
    theme: 'dark',
    avatar: 'radar',
    fontScale: 110,
    accentColor: '#0ea5e9',
  };

  const localDefaultPayload = { ...defaultPreferences };

  const adoptServerWhenNoLocal = shouldAdoptServerPreferences({
    hasLocalPreferencesMarker: false,
    serverPreferences: serverPayload,
  });
  assert.equal(adoptServerWhenNoLocal, true, 'Expected server preferences to hydrate when no local preference marker exists.');

  const blockServerWhenLocal = shouldAdoptServerPreferences({
    hasLocalPreferencesMarker: true,
    serverPreferences: serverPayload,
  });
  assert.equal(blockServerWhenLocal, false, 'Expected local personalization marker to prevent server overwrite.');

  const persistBlockedBeforeHydration = shouldPersistRemote({
    isAuthenticated: true,
    localStateHydrated: true,
    serverStateHydrated: false,
  });
  assert.equal(persistBlockedBeforeHydration, false, 'Expected remote persistence to be blocked until server hydration completes.');

  const persistBlockedWhenNotAuthenticated = shouldPersistRemote({
    isAuthenticated: false,
    localStateHydrated: true,
    serverStateHydrated: true,
  });
  assert.equal(persistBlockedWhenNotAuthenticated, false, 'Expected remote persistence to be blocked when user is unauthenticated.');

  const persistAllowedAfterHydration = shouldPersistRemote({
    isAuthenticated: true,
    localStateHydrated: true,
    serverStateHydrated: true,
  });
  assert.equal(persistAllowedAfterHydration, true, 'Expected remote persistence to proceed after hydration gates are satisfied.');

  const markDefaultAsLocal = shouldMarkLocalPreferencesPresent(localDefaultPayload, false);
  assert.equal(markDefaultAsLocal, false, 'Expected default-only preferences to avoid setting local personalization marker.');

  const markCustomizedAsLocal = shouldMarkLocalPreferencesPresent({
    ...defaultPreferences,
    theme: 'midnight',
  }, false);
  assert.equal(markCustomizedAsLocal, true, 'Expected customized preferences to set local personalization marker.');

  const mergedServerTheme = normalizePreferences(serverPayload).theme;
  assert.equal(mergedServerTheme, 'dark', 'Expected normalized server payload to preserve valid custom theme.');

  const normalizedInvalidTheme = normalizePreferences({ theme: 'invalid-theme' }).theme;
  assert.equal(normalizedInvalidTheme, 'auto', 'Expected invalid theme to fall back to default during normalization.');
}

runAssistantPersonalizationInteractionSmoke();
console.log('[PASS ] Assistant personalization interaction smoke checks passed.');
