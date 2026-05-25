import { ThemeType } from "../../../types/global";

export interface ThemeModalProps {
  showThemeModal: boolean;
  theme: ThemeType;
  themeHue: number;
  setThemeHue: (hue: number) => void;
  onClose: () => void;
}
