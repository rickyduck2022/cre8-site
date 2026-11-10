export const themeColors = {
  neutral: {
    50: "#F2F3F5",
    400: "#9299A5",
    700: "#3A414E",
    800: "#303746",
    900: "#222630",
    950: "#171A20",
  },
  orange: {
    400: "#FF922B",
    500: "#F57C00",
    600: "#D46B00",
  },
  cyan: {
    400: "#35C5D8",
  },
  green: {
    400: "#4DD89A",
  },
  blue: {
    500: "#4285F4",
  },
} as const;

export type ThemeColors = typeof themeColors;

export const semanticTokens = {
  surface: {
    canvas: "var(--color-neutral-950)",
    raised: "var(--color-neutral-900)",
    control: "var(--color-neutral-800)",
  },
  border: {
    default: "var(--color-neutral-700)",
  },
  text: {
    primary: "var(--color-neutral-50)",
    secondary: "var(--color-neutral-400)",
    "on-accent": "var(--color-neutral-950)",
  },
  action: {
    primary: "var(--color-orange-500)",
    "primary-hover": "var(--color-orange-400)",
    "primary-pressed": "var(--color-orange-600)",
  },
  audio: {
    active: "var(--color-cyan-400)",
    highlight: "var(--color-neutral-50)",
    "dub-active": "var(--color-cyan-400)",
    "sample-active": "var(--color-green-400)",
    inactive: "var(--color-neutral-700)",
  },
  focus: {
    ring: "var(--color-cyan-400)",
  },
  link: {
    default: "var(--color-blue-500)",
  },
  audience: {
    worldwide: "var(--color-blue-500)",
    private: "var(--color-cyan-400)",
    alist: "var(--action-primary)",
  },
  release: {
    "alist-surface": "var(--color-neutral-950)",
    "alist-text": "var(--color-neutral-50)",
    "alist-text-secondary": "var(--color-neutral-400)",
    "alist-accent": "var(--audience-alist)",
    "alist-accent-hover": "var(--action-primary-hover)",
    "alist-accent-pressed": "var(--action-primary-pressed)",
    "alist-waveform-inactive": "color-mix(in srgb, var(--release-alist-surface) 70%, var(--release-alist-accent))",
    "alist-media-surface": "color-mix(in srgb, var(--release-alist-accent) 10%, var(--release-alist-surface))",
    "alist-error": "var(--color-orange-400)",
  },
  status: {
    error: "var(--color-danger)",
  },
} as const;

export type SemanticTokens = typeof semanticTokens;

export const typography = {
  font: {
    interface: "var(--font-interface)",
    mono: "var(--font-mono)",
  },
  size: {
    micro: "var(--type-size-micro)",
    caption: "var(--type-size-caption)",
    label: "var(--type-size-label)",
    compact: "var(--type-size-compact)",
    body: "var(--type-size-body)",
    input: "var(--type-size-input)",
    section: "var(--type-size-section)",
    heading: "var(--type-size-heading)",
    title: "var(--type-size-title)",
    page: "var(--type-size-page)",
    buttonSmall: "var(--type-size-button-small)",
    buttonMedium: "var(--type-size-button-medium)",
    buttonLarge: "var(--type-size-button-large)",
  },
  leading: {
    tight: "var(--type-leading-tight)",
    control: "var(--type-leading-control)",
    body: "var(--type-leading-body)",
  },
  weight: {
    regular: "var(--type-weight-regular)",
    medium: "var(--type-weight-medium)",
    strong: "var(--type-weight-strong)",
  },
  tracking: {
    heading: "var(--type-tracking-heading)",
    eyebrow: "var(--type-tracking-eyebrow)",
  },
} as const;
export type Typography = typeof typography;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export type Spacing = (typeof spacing)[number];

export const radius = [0, 1, 2, 4, 6, 10] as const;
export type Radius = (typeof radius)[number];
