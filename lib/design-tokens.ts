export const designTokens = {
  spacing: ["0", "0.25rem", "0.5rem", "0.75rem", "1rem", "1.5rem", "2rem", "3rem"],
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    xxl: "1.5rem",
  },
  radii: {
    sm: "0.375rem",
    md: "0.625rem",
    lg: "0.875rem",
    xl: "1.125rem",
  },
  elevation: {
    low: "0 8px 24px rgba(0, 0, 0, 0.25)",
    high: "0 16px 36px rgba(0, 0, 0, 0.45)",
  },
  colors: {
    bg: "#111210",
    surface: "#1a1c19",
    surface2: "#21231f",
    text: "#f5f2e8",
    muted: "#a6a394",
    accent: "#d8a960",
    accentSoft: "#6f5837",
    border: "#34382f",
  },
} as const;
