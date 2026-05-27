import { defaultBusinessProfile, type BusinessProfile } from "./businessProfile";

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mode: "dark" | "light";
  tokens?: Record<string, string>;
}

export function themeFromBusinessProfile(profile: BusinessProfile = defaultBusinessProfile): ThemeConfig {
  return {
    primaryColor: profile.primary_color || defaultBusinessProfile.primary_color,
    secondaryColor: profile.secondary_color || defaultBusinessProfile.secondary_color,
    accentColor: profile.accent_color || defaultBusinessProfile.accent_color,
    mode: "light",
    tokens: {
      "--pos-bg": "#EEF2F7",
      "--pos-bg-soft": "#F5F7FA",
      "--pos-panel": "#FFFFFF",
      "--pos-panel-2": "#F5F7FA",
      "--pos-card": "#FFFFFF",
      "--pos-card-hover": "#F8FAFC",
      "--pos-border": "#D8E1EC",
      "--pos-border-strong": "#B8C8DA",
      "--pos-blue": "#075EC8",
      "--pos-blue-2": "#0B7CFF",
      "--pos-blue-soft": "#E6F1FF",
      "--pos-cyan-soft": "#E8F8FF",
      "--pos-text": "#0E1B33",
      "--pos-muted": "#5F6F86",
      "--pos-muted-2": "#8A98AA",
      "--pos-success": "#16A34A",
      "--pos-warning": "#F59E0B",
      "--pos-danger": "#DC2626",
      "--pos-purple": "#A855F7"
    }
  };
}

export function applyThemeConfig(theme: ThemeConfig): void {
  Object.entries(theme.tokens ?? {}).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
  document.documentElement.style.setProperty("--pos-blue", theme.primaryColor);
  document.documentElement.style.setProperty("--pos-blue-2", theme.secondaryColor);
  document.documentElement.style.setProperty("--brand-primary", theme.primaryColor);
  document.documentElement.style.setProperty("--brand-accent", theme.accentColor);
}
