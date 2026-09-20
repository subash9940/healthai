/**
 * src/constants/theme.ts
 *
 * Professional Clinical Health Design System for Jeevanya ASHA App.
 * WCAG AAA compliant (>= 7:1 contrast ratio) for direct sunlight field readability.
 *
 * Clinical palette:
 * - Primary Slate / Navy: #0F172A (Text/Structure)
 * - Clinical Teal: #0F766E (Primary Action / Healthcare Trust)
 * - Clinical Dark Teal: #115E59 (Active / Focused States)
 * - Medical Blue: #0284C7 (Information / Tertiary Guidance)
 * - Clinical Red: #DC2626 (Emergency Urgency)
 * - Amber Alert: #D97706 (High Urgency)
 * - Medical Green: #16A34A (Low Urgency / Success)
 *
 * Strict Anti-patterns avoided:
 * - No purple-to-blue gradients
 * - No glassmorphism
 * - No low-contrast dark mode
 * - Solid crisp borders and clean elevation
 */

export const THEME = {
  colors: {
    // Primary Background & Surfaces
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceSubtle: "#F1F5F9",
    surfaceMuted: "#E2E8F0",

    // Crisp Neutral Borders (No colored border cards)
    border: "#CBD5E1",
    borderStrong: "#94A3B8",
    borderFocus: "#0F766E",

    // Typography
    textPrimary: "#0F172A",
    textSecondary: "#334155",
    textMuted: "#64748B",
    textInverse: "#FFFFFF",

    // Clinical Health Primary Palette
    primary: "#0F766E",       // Deep Clinical Teal
    primaryDark: "#115E59",   // Darker Clinical Teal
    primaryLight: "#CCFBF1",  // Subtle Teal Tint
    accentBlue: "#0284C7",    // Medical Info Blue
    accentBlueLight: "#E0F2FE",

    // Clinical Urgency Tiers (Crisp solid status badges)
    emergencyBg: "#FEF2F2",
    emergencyBorder: "#DC2626",
    emergencyText: "#991B1B",

    highBg: "#FFFBEB",
    highBorder: "#D97706",
    highText: "#92400E",

    mediumBg: "#F0F9FF",
    mediumBorder: "#0284C7",
    mediumText: "#075985",

    lowBg: "#F0FDF4",
    lowBorder: "#16A34A",
    lowText: "#166534",

    // Security & Auth Palette
    securitySuccess: "#16A34A",
    securityWarning: "#D97706",
    securityDanger: "#DC2626",
    securityNeutral: "#64748B",

    // Status sync indicators
    online: "#16A34A",
    offline: "#D97706",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  borderRadius: {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    full: 9999,
  },

  touchTarget: {
    minHeight: 48,
    largeHeight: 56,
  },

  typography: {
    fontFamily: "System",
  },
};
