/**
 * Design tokens aligned to the AEGIS-AI brand identity (logo artwork):
 * deep plum-black base, violet → magenta signature gradient, soft lavender
 * text. Trauma-informed: alarming red is reserved exclusively for the
 * SOS / emergency surface so it always reads as meaningful — brand magenta
 * is never used for danger.
 */
export const colors = {
  bg: "#0B0614", // deep plum-black (logo background)
  bgElevated: "#120A1E",
  card: "#190F2A", // violet-tinted card
  cardBorder: "rgba(216,180,254,0.14)", // purple-200/14 hairline
  text: "#FAF7FF",
  textMuted: "#D8CCEE", // soft lavender
  textFaint: "#9D8FBA", // muted violet-grey
  primary: "#A855F7", // purple-500 (logo violet)
  primaryDeep: "#7C3AED", // violet-600
  sky: "#A855F7", // legacy alias — now brand violet
  accent: "#EC4899", // magenta (logo pink)
  success: "#34D399", // emerald-400
  warning: "#FBBF24", // amber-400
  danger: "#F43F5E", // rose-500 — SOS only
  dangerDeep: "#E11D48", // rose-600
  overlay: "rgba(11,6,20,0.65)",
};

/** Gradient stops matching the logo's violet → magenta glow. */
export const gradients = {
  brand: ["#7C3AED", "#A855F7", "#EC4899"] as const,
  primary: ["#7C3AED", "#A855F7"] as const,
  sos: ["#FB7185", "#E11D48"] as const,
  hero: ["rgba(168,85,247,0.18)", "rgba(124,58,237,0.07)", "rgba(236,72,153,0.14)"] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const font = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  small: 13,
  tiny: 11,
};

/** Minimum accessible touch target per WCAG / spec §16. */
export const TOUCH_MIN = 48;
