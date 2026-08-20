export type ThemeId = "obsidian" | "creed" | "punisher" | "spectre" | "ronin";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  tagline: string;
  accent: string;
  mark: string;
  /** Theme gate visuals */
  gate: {
    bgInner: string;
    bgOuter: string;
    faceInner: string;
    faceOuter: string;
    ink: string;
    muted: string;
    onAccent: string;
    stopBg: string;
    stopBorder: string;
    stopText: string;
    wheelBorder: string;
  };
};

export const THEMES: ThemeDef[] = [
  {
    id: "obsidian",
    name: "OBSIDIAN",
    tagline: "Noir protocol",
    accent: "#3b82f6",
    mark: "◆",
    gate: {
      bgInner: "#1a2744",
      bgOuter: "#050508",
      faceInner: "#243356",
      faceOuter: "#0c101c",
      ink: "#e5e2e1",
      muted: "#8b9bb8",
      onAccent: "#071018",
      stopBg: "rgba(14, 20, 36, 0.92)",
      stopBorder: "rgba(59, 130, 246, 0.4)",
      stopText: "#b8c7e0",
      wheelBorder: "rgba(59, 130, 246, 0.28)",
    },
  },
  {
    id: "creed",
    name: "CREED",
    tagline: "Nothing is true",
    accent: "#d4af37",
    mark: "▲",
    gate: {
      bgInner: "#2a2e1c",
      bgOuter: "#070806",
      faceInner: "#32361f",
      faceOuter: "#121410",
      ink: "#e8e6dc",
      muted: "#a8a48c",
      onAccent: "#1a1808",
      stopBg: "rgba(22, 24, 18, 0.92)",
      stopBorder: "rgba(212, 175, 55, 0.35)",
      stopText: "#d4cfb8",
      wheelBorder: "rgba(212, 175, 55, 0.28)",
    },
  },
  {
    id: "punisher",
    name: "PUNISHER",
    tagline: "One man war",
    accent: "#c41e3a",
    mark: "✕",
    gate: {
      bgInner: "#3a1518",
      bgOuter: "#050202",
      faceInner: "#4a1a1e",
      faceOuter: "#140a0b",
      ink: "#ece8e8",
      muted: "#b09090",
      onAccent: "#1a0508",
      stopBg: "rgba(28, 12, 14, 0.92)",
      stopBorder: "rgba(196, 30, 58, 0.4)",
      stopText: "#d8b0b6",
      wheelBorder: "rgba(196, 30, 58, 0.32)",
    },
  },
  {
    id: "spectre",
    name: "SPECTRE",
    tagline: "Silent frequency",
    accent: "#3dd6c3",
    mark: "◎",
    gate: {
      bgInner: "#143038",
      bgOuter: "#040a0c",
      faceInner: "#1a3c44",
      faceOuter: "#0a161a",
      ink: "#dcecec",
      muted: "#8fadb0",
      onAccent: "#041416",
      stopBg: "rgba(12, 28, 32, 0.92)",
      stopBorder: "rgba(61, 214, 195, 0.38)",
      stopText: "#b0d8d4",
      wheelBorder: "rgba(61, 214, 195, 0.3)",
    },
  },
  {
    id: "ronin",
    name: "RONIN",
    tagline: "Blade without master",
    accent: "#c4a574",
    mark: "刀",
    gate: {
      bgInner: "#3a2e22",
      bgOuter: "#080605",
      faceInner: "#443628",
      faceOuter: "#14100c",
      ink: "#efe8de",
      muted: "#a89a88",
      onAccent: "#1a140c",
      stopBg: "rgba(26, 20, 14, 0.92)",
      stopBorder: "rgba(196, 165, 116, 0.38)",
      stopText: "#d4c4a8",
      wheelBorder: "rgba(196, 165, 116, 0.3)",
    },
  },
];

export const THEME_STORAGE_KEY = "sy-theme";

export function isThemeId(v: string | null | undefined): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function readStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(v)) return v;
  } catch {
    /* ignore */
  }
  return "obsidian";
}
