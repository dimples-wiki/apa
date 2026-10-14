export const THEME_KEY = "filmstudio-theme";

export type Theme = "light" | "dark" | "system";

export function getTheme(): Theme {
  // URL 参数优先（用于截图/自动化测试指定主题，并落盘保持一致）
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (fromUrl === "light" || fromUrl === "dark" || fromUrl === "system") {
    localStorage.setItem(THEME_KEY, fromUrl);
    return fromUrl;
  }
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "system" ? stored : "dark";
}

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
