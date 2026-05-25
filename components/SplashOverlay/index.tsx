import React from "react";
import { Animated, Image, View } from "react-native";
import { PLAY_GLOW_PNG } from "../../utils/glowImages";
import { LibraryBackground } from "../LibraryBackground";
import { getStyles } from "./styles";
import { SplashOverlayProps } from "./types/SplashOverlayTypes";

export const SplashOverlay: React.FC<SplashOverlayProps> = ({
  showSplash,
  splashAnim,
  logoScale,
  themeHue,
}) => {
  const styles = getStyles();

  if (!showSplash) return null;

  return (
    <Animated.View
      style={[
        styles.splashContainer,
        {
          opacity: splashAnim,
        },
      ]}
      pointerEvents="none"
    >
      <LibraryBackground themeHue={themeHue} />
      <View style={styles.splashInner}>
        <Image
          source={{ uri: PLAY_GLOW_PNG }}
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            opacity: 0.85,
            tintColor: `hsl(${themeHue}, 100%, 65%)`,
          }}
          resizeMode="contain"
        />
        <Animated.Image
          source={require("../../assets/images/logo.png")}
          style={{
            width: 140,
            height: 140,
            tintColor: `hsl(${themeHue}, 100%, 63%)`,
            transform: [{ scale: logoScale }],
          }}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
};

export default SplashOverlay;
