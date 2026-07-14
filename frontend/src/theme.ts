export type ThemePalette = {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  background: string;
  text: string;
  mutedText: string;
  navbarStart: string;
  navbarEnd: string;
};

export const predefinedThemes: ThemePalette[] = [
  {
    id: 'soft-slate',
    name: 'Soft Slate',
    description: 'Professional cool-neutral palette with gentle contrast.',
    primary: '#5b7cfa',
    secondary: '#8a9bb2',
    accent: '#4fb3c8',
    surface: '#fdfdff',
    background: '#f3f6fb',
    text: '#1f2a37',
    mutedText: '#66758a',
    navbarStart: '#334155',
    navbarEnd: '#475569',
  },
  {
    id: 'pastel-dawn',
    name: 'Pastel Dawn',
    description: 'Soft pastel dashboard with warm sunrise highlights.',
    primary: '#c084fc',
    secondary: '#f9a8d4',
    accent: '#67e8f9',
    surface: '#fff7fb',
    background: '#fef6fb',
    text: '#3f2d56',
    mutedText: '#7c5c99',
    navbarStart: '#7c3aed',
    navbarEnd: '#db2777',
  },
  {
    id: 'frosted-command',
    name: 'Frosted Command',
    description: 'Cool frost palette with crisp operational contrast.',
    primary: '#60a5fa',
    secondary: '#93c5fd',
    accent: '#22d3ee',
    surface: '#f8fcff',
    background: '#edf6ff',
    text: '#0f2942',
    mutedText: '#3f6078',
    navbarStart: '#0f766e',
    navbarEnd: '#1d4ed8',
  },
  {
    id: 'mist-lilac',
    name: 'Mist Lilac',
    description: 'Modern soft violet/indigo palette for calm analytics views.',
    primary: '#8b9cf4',
    secondary: '#b8aee0',
    accent: '#8ed9d4',
    surface: '#fcfbff',
    background: '#f5f3fb',
    text: '#2d2646',
    mutedText: '#6f6790',
    navbarStart: '#5b5fae',
    navbarEnd: '#7c72b8',
  },
  {
    id: 'sage-horizon',
    name: 'Sage Horizon',
    description: 'Soft green-gray palette with executive dashboard tone.',
    primary: '#6ea88a',
    secondary: '#98b3a7',
    accent: '#7fb6c7',
    surface: '#fbfdfc',
    background: '#f1f6f3',
    text: '#24352e',
    mutedText: '#5f766b',
    navbarStart: '#2f5d50',
    navbarEnd: '#4a7a67',
  },
  {
    id: 'arctic-glass',
    name: 'Arctic Glass',
    description: 'Bright frosted blue with clean, modern UI contrast.',
    primary: '#5aa7e8',
    secondary: '#9ec4dd',
    accent: '#6fd4c1',
    surface: '#fafdff',
    background: '#ecf5fb',
    text: '#153146',
    mutedText: '#4e6f85',
    navbarStart: '#1f5f8b',
    navbarEnd: '#3b82a9',
  },
  {
    id: 'sandstone-modern',
    name: 'Sandstone Modern',
    description: 'Soft beige and clay palette for warm, professional reporting.',
    primary: '#c6846b',
    secondary: '#d3a996',
    accent: '#9fb8ab',
    surface: '#fffdf9',
    background: '#f8f2eb',
    text: '#3d2b24',
    mutedText: '#7b6458',
    navbarStart: '#9b5d45',
    navbarEnd: '#b77a5f',
  },
  {
    id: 'aurora-soft',
    name: 'Aurora Soft',
    description: 'Refined teal/plum modern palette with soft gradients.',
    primary: '#5f98c8',
    secondary: '#9b8bbd',
    accent: '#64c2b3',
    surface: '#fbfcff',
    background: '#f2f5fa',
    text: '#253248',
    mutedText: '#637089',
    navbarStart: '#3f5f7d',
    navbarEnd: '#6a5d8e',
  },
  {
    id: 'pearl-minimal',
    name: 'Pearl Minimal',
    description: 'Minimalist soft gray-blue palette for executive readability.',
    primary: '#6f8aa8',
    secondary: '#a3b1bf',
    accent: '#82b6ae',
    surface: '#ffffff',
    background: '#f6f8fa',
    text: '#27323d',
    mutedText: '#6b7784',
    navbarStart: '#3f4d5a',
    navbarEnd: '#566574',
  },
  {
    id: 'pastel-orchid-mist',
    name: 'Pastel Orchid Mist',
    description: 'Soft orchid and sky pastel blend with elegant cool contrast.',
    primary: '#b69cf8',
    secondary: '#e7b7dd',
    accent: '#9ddcf2',
    surface: '#fffaff',
    background: '#f8f4fb',
    text: '#352f4f',
    mutedText: '#776f96',
    navbarStart: '#6f63a9',
    navbarEnd: '#9b6bb2',
  },
  {
    id: 'pastel-apricot-drift',
    name: 'Pastel Apricot Drift',
    description: 'Warm apricot pastel with mint accents for gentle readability.',
    primary: '#e59f84',
    secondary: '#f0c7af',
    accent: '#9fcfc4',
    surface: '#fffdfb',
    background: '#fbf4ee',
    text: '#49372f',
    mutedText: '#8a6f63',
    navbarStart: '#b67a60',
    navbarEnd: '#cf8f74',
  },
  {
    id: 'frost-glacier',
    name: 'Frost Glacier',
    description: 'Icy blue/teal frosted dashboard with clean operational highlights.',
    primary: '#6eaee8',
    secondary: '#b3d2e9',
    accent: '#7ad9d2',
    surface: '#fbfeff',
    background: '#edf5fa',
    text: '#163246',
    mutedText: '#55728a',
    navbarStart: '#2d5f84',
    navbarEnd: '#4c7ea5',
  },
  {
    id: 'frost-violet-glass',
    name: 'Frost Violet Glass',
    description: 'Frosted lilac/indigo glass tone with crisp professional contrast.',
    primary: '#8fa4ee',
    secondary: '#c2c8ec',
    accent: '#8cd7dd',
    surface: '#fcfcff',
    background: '#f1f2fb',
    text: '#2d3150',
    mutedText: '#686d92',
    navbarStart: '#5a6295',
    navbarEnd: '#7981b1',
  },
  {
    id: 'pearl-champagne',
    name: 'Pearl Champagne',
    description: 'Luminous pearl neutral with refined champagne warmth.',
    primary: '#b89f84',
    secondary: '#d5c7b3',
    accent: '#a8c5c1',
    surface: '#fffefc',
    background: '#f7f4ef',
    text: '#3e352c',
    mutedText: '#7a6b5d',
    navbarStart: '#7c6855',
    navbarEnd: '#9a816a',
  },
  {
    id: 'pearl-graphite',
    name: 'Pearl Graphite',
    description: 'Executive pearl-gray palette with subtle teal polish.',
    primary: '#8194aa',
    secondary: '#bcc6d0',
    accent: '#89bcb7',
    surface: '#ffffff',
    background: '#f3f6f8',
    text: '#2b3640',
    mutedText: '#6a7682',
    navbarStart: '#4f5d6b',
    navbarEnd: '#657684',
  },
  {
    id: 'pastel-aqua-bloom',
    name: 'Pastel Aqua Bloom',
    description: 'Fresh aqua pastel family with rose undertones and airy surfaces.',
    primary: '#7ebfd3',
    secondary: '#b9d8e4',
    accent: '#dba7c4',
    surface: '#fcfdff',
    background: '#f1f7fb',
    text: '#2a3f4a',
    mutedText: '#68808d',
    navbarStart: '#4f8ea4',
    navbarEnd: '#6da7ba',
  },
  {
    id: 'frost-mint-opal',
    name: 'Frost Mint Opal',
    description: 'Opal-toned frost with mint and soft cyan signal accents.',
    primary: '#79b9b1',
    secondary: '#b8d8d2',
    accent: '#8fcde8',
    surface: '#faffff',
    background: '#eef8f6',
    text: '#213b3a',
    mutedText: '#5f7d7b',
    navbarStart: '#3d7670',
    navbarEnd: '#57918a',
  },
  {
    id: 'pearl-cobalt-fog',
    name: 'Pearl Cobalt Fog',
    description: 'Executive pearl slate with cobalt depth and clean contrast.',
    primary: '#6f90be',
    secondary: '#b8c4d2',
    accent: '#8fc6cf',
    surface: '#ffffff',
    background: '#f2f6fb',
    text: '#243345',
    mutedText: '#63778b',
    navbarStart: '#3c526d',
    navbarEnd: '#526d89',
  },
  {
    id: 'pastel-rosewater-cloud',
    name: 'Pastel Rosewater Cloud',
    description: 'Soft rosewater pastel with calm cloud neutrals for command views.',
    primary: '#c693b8',
    secondary: '#e2bfd1',
    accent: '#9bc7d8',
    surface: '#fffdfd',
    background: '#f8f2f6',
    text: '#412f3f',
    mutedText: '#81677f',
    navbarStart: '#8a5f84',
    navbarEnd: '#a3729a',
  },
  {
    id: 'frost-silver-lagoon',
    name: 'Frost Silver Lagoon',
    description: 'Frosted silver-blue palette with lagoon accents for operational telemetry.',
    primary: '#79a7c9',
    secondary: '#c0d0de',
    accent: '#79c8bf',
    surface: '#fbfdff',
    background: '#eef4f8',
    text: '#21384a',
    mutedText: '#5d788b',
    navbarStart: '#3d647e',
    navbarEnd: '#5683a0',
  },
];

export const customThemeSeed: ThemePalette = {
  id: 'custom',
  name: 'Custom Theme',
  description: 'User-defined palette saved locally in the browser.',
  primary: '#7c3aed',
  secondary: '#64748b',
  accent: '#0ea5e9',
  surface: '#ffffff',
  background: '#f5f7fb',
  text: '#1f2937',
  mutedText: '#64748b',
  navbarStart: '#1e3a8a',
  navbarEnd: '#312e81',
};

function normalizeHex(hex: string): string {
  const raw = hex.trim().replace('#', '');
  if (raw.length === 3) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  }

  if (raw.length === 6) {
    return `#${raw}`.toLowerCase();
  }

  return '#000000';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (value: number) => clamp(value).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function blendHex(baseHex: string, mixHex: string, mixWeight: number): string {
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHex);
  const weight = Math.max(0, Math.min(1, mixWeight));

  return rgbToHex(
    base.r + ((mix.r - base.r) * weight),
    base.g + ((mix.g - base.g) * weight),
    base.b + ((mix.b - base.b) * weight),
  );
}

export function applyThemeToDocument(theme: ThemePalette): void {
  const root = document.documentElement;
  root.style.setProperty('--ipoc-primary', theme.primary);
  root.style.setProperty('--ipoc-secondary', theme.secondary);
  root.style.setProperty('--ipoc-accent', theme.accent);
  root.style.setProperty('--ipoc-surface', theme.surface);
  root.style.setProperty('--ipoc-background', theme.background);
  root.style.setProperty('--ipoc-text', theme.text);
  root.style.setProperty('--ipoc-muted-text', theme.mutedText);
  root.style.setProperty('--ipoc-navbar-start', theme.navbarStart);
  root.style.setProperty('--ipoc-navbar-end', theme.navbarEnd);
  root.style.setProperty('--ipoc-analytics-bar-1', theme.primary);
  root.style.setProperty('--ipoc-analytics-bar-2', theme.accent);
  root.style.setProperty('--ipoc-analytics-bar-3', theme.secondary);
  root.style.setProperty('--ipoc-analytics-bar-4', theme.navbarEnd);
  root.style.setProperty('--ipoc-chart-series-1', theme.primary);
  root.style.setProperty('--ipoc-chart-series-2', theme.accent);
  root.style.setProperty('--ipoc-chart-series-3', theme.secondary);
  root.style.setProperty('--ipoc-chart-series-4', theme.navbarEnd);
  root.style.setProperty('--ipoc-chart-series-5', blendHex(theme.primary, theme.accent, 0.45));
  root.style.setProperty('--ipoc-chart-series-6', blendHex(theme.secondary, theme.navbarEnd, 0.4));
  root.style.setProperty('--ipoc-chart-critical', blendHex(theme.primary, '#b91c1c', 0.42));
  root.style.setProperty('--ipoc-chart-warning', blendHex(theme.accent, '#b45309', 0.48));
  root.style.setProperty('--ipoc-chart-success', blendHex(theme.accent, '#065f46', 0.34));
  root.style.setProperty('--ipoc-chart-info', blendHex(theme.primary, theme.accent, 0.35));
  root.style.setProperty('--ipoc-chart-neutral', blendHex(theme.secondary, '#6b7280', 0.28));
}
