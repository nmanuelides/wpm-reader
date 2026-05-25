import { Animated } from "react-native";

export interface SplashOverlayProps {
  showSplash: boolean;
  splashAnim: Animated.Value;
  logoScale: Animated.Value;
  themeHue: number;
}
