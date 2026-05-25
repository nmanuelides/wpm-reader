import React from "react";
import { Image, TouchableOpacity, View } from "react-native";
import {
  BUTTON_GLOW_PNG,
  MINI_BUTTON_GLOW_PNG,
  PLAY_GLOW_PNG,
} from "../../utils/glowImages";
import { styles } from "./styles";
import { GlowButtonProps } from "./types/GlowButtonTypes";

const GLOW_ASSETS = {
  button: BUTTON_GLOW_PNG,
  mini: MINI_BUTTON_GLOW_PNG,
  play: PLAY_GLOW_PNG,
};

export const GlowButton: React.FC<GlowButtonProps> = ({
  theme,
  variant = "circle",
  size = 42,
  width,
  glowType = "button",
  glowColor,
  bgType = "glass",
  containerStyle,
  buttonStyle,
  glowWidth,
  glowHeight,
  children,
  ...touchableProps
}) => {
  const activeGlowColor = glowColor || `hsl(${theme.hue}, 100%, 65%)`;

  // 1. Determine Glow Size based on variant and button size
  let glowWidthVal = glowWidth !== undefined ? glowWidth : size * 1.8;
  let glowHeightVal = glowHeight !== undefined ? glowHeight : size * 1.8;
  if (glowWidth === undefined && glowHeight === undefined) {
    if (variant === "pill") {
      glowWidthVal = typeof width === "number" ? width * 1.15 : 150;
      glowHeightVal = size * 1.8;
    } else if (glowType === "play") {
      glowWidthVal = 98;
      glowHeightVal = 98;
    }
  }

  // 2. Resolve backgrounds and borders
  let backgroundColor = theme.buttonBg;
  let borderColor = `hsla(${theme.hue}, 100%, 80%, 0.12)`;
  let borderTopColor = `hsla(${theme.hue}, 100%, 85%, 0.25)`;

  if (bgType === "transparent") {
    backgroundColor = "transparent";
  } else if (bgType === "delete") {
    backgroundColor = theme.deleteButtonBg;
    borderColor = "hsla(0, 100%, 80%, 0.12)";
    borderTopColor = "hsla(0, 100%, 85%, 0.25)";
  }

  // 3. Resolve button base styles
  const baseButtonStyle = {
    height: size,
    width: variant === "circle" ? size : (width && width !== "100%" ? width : "auto"),
    borderRadius: size / 2,
    backgroundColor,
    borderWidth: 1,
    borderColor,
    borderTopColor,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    ...(variant === "pill" && width === "100%" ? { alignSelf: "stretch" as const } : null),
  };

  const wrapperStyle = [
    styles.wrapper,
    variant === "pill" && {
      alignItems: "stretch" as const,
      width: width && width !== "100%" ? width : undefined,
      ...(width === "100%" ? { alignSelf: "stretch" as const } : null),
    },
    containerStyle,
  ];

  return (
    <View style={wrapperStyle}>
      {glowType !== "none" && (
        <Image
          source={{ uri: GLOW_ASSETS[glowType] }}
          style={[
            styles.glow,
            {
              width: glowWidthVal,
              height: glowHeightVal,
              tintColor: activeGlowColor,
            },
          ]}
          resizeMode="stretch"
        />
      )}
      <TouchableOpacity
        style={[baseButtonStyle, buttonStyle]}
        activeOpacity={0.7}
        {...touchableProps}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

export default GlowButton;
