export interface BookType {
  id: string;
  name: string;
  uri: string;
  progress: number;
  totalWords: number;
  coverImage: string | null;
}

export interface ThemeType {
  hue: number;
  accent: string;
  bg: string;
  surface: string;
  textLight: string;
  textMuted: string;
  textDark: string;
  textOnAccent: string;
  buttonBg: string;
  buttonText: string;
  deleteButtonBg: string;
  deleteButtonText: string;
}

export interface ChapterType {
  index: number;
  title: string;
}

export interface SafeAreaInsetsType {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
