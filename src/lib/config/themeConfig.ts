import { defaultBusinessProfile, type BusinessProfile } from "./businessProfile";

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mode: "dark" | "light";
}

export function themeFromBusinessProfile(profile: BusinessProfile = defaultBusinessProfile): ThemeConfig {
  return {
    primaryColor: profile.primary_color || defaultBusinessProfile.primary_color,
    secondaryColor: profile.secondary_color || defaultBusinessProfile.secondary_color,
    accentColor: profile.accent_color || defaultBusinessProfile.accent_color,
    mode: "dark"
  };
}

export function applyThemeConfig(theme: ThemeConfig): void {
  document.documentElement.style.setProperty("--pos-blue", theme.primaryColor);
  document.documentElement.style.setProperty("--pos-blue-2", theme.secondaryColor);
  document.documentElement.style.setProperty("--brand-primary", theme.primaryColor);
  document.documentElement.style.setProperty("--brand-accent", theme.accentColor);
}

