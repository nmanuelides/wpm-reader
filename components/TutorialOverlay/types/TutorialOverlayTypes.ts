import { SafeAreaInsetsType, ThemeType } from "../../../types/global";

export interface TutorialOverlayProps {
  showTutorial: boolean;
  theme: ThemeType;
  insets: SafeAreaInsetsType;
  onClose: (tutorialSeen: boolean) => void;
}
