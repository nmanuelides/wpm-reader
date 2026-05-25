import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { RADIAL_GLOW_PNG } from "../../utils/glowImages";
import { getStyles } from "./styles";
import { LibraryBackgroundProps } from "./types/LibraryBackgroundTypes";

export const LibraryBackground: React.FC<LibraryBackgroundProps> = ({
  themeHue,
}) => {
  const styles = getStyles();
  return (
    <View style={styles.backgroundContainer} pointerEvents="none">
      {/* Base dark backdrop gradient (smoothly fades from dark theme hue down to near-black) */}
      <LinearGradient
        colors={[`hsl(${themeHue}, 25%, 8%)`, `hsl(${themeHue}, 15%, 3%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Outer ambient glow (Wide, soft fade) */}
      <Image
        source={{ uri: RADIAL_GLOW_PNG }}
        style={{
          position: "absolute",
          top: "55%",
          left: -300,
          width: 600,
          height: 600,
          opacity: 0.35,
          transform: [{ translateY: -300 }],
          tintColor: `hsl(${themeHue}, 70%, 30%)`,
        }}
        resizeMode="stretch"
      />
      {/* Inner core glow (Intense center) */}
      <Image
        source={{ uri: RADIAL_GLOW_PNG }}
        style={{
          position: "absolute",
          top: "55%",
          left: -275,
          width: 500,
          height: 500,
          opacity: 0.85,
          transform: [{ translateY: -275 }],
          tintColor: `hsl(${themeHue}, 75%, 35%)`,
        }}
        resizeMode="stretch"
      />

      {/* Subtle top-left ambient light glow */}
      <LinearGradient
        colors={[`hsl(${themeHue}, 70%, 10%)`, "transparent"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Main glowing light source leak on the center-left */}
      <LinearGradient
        colors={[`hsl(${themeHue}, 100%, 15%)`, "transparent"]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0.6, y: 0.5 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.95,
        }}
      />
    </View>
  );
};

export default LibraryBackground;
