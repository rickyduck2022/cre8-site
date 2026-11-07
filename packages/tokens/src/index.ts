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
    inactive: "var(--color-neutral-700)",
  },
  focus: {
    ring: "var(--color-cyan-400)",
  },
  link: {
    default: "var(--color-blue-500)",
  },
} as const;

export type SemanticTokens = typeof semanticTokens;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export type Spacing = (typeof spacing)[number];

export const radius = [0, 1, 2, 4, 6, 10] as const;
export type Radius = (typeof radius)[number];
