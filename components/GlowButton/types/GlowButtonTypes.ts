import React from "react";
import { StyleProp, TouchableOpacityProps, ViewStyle } from "react-native";
import { ThemeType } from "../../../types/global";

export interface GlowButtonProps extends TouchableOpacityProps {
  theme: ThemeType;
  /** Shape variant: 'circle' (circular buttons) | 'pill' (wide actions) | 'custom' */
  variant?: "circle" | "pill" | "custom";
  /** Button dimensions: used for circle diameter, or pill height */
  size?: number;
  /** Optional custom width (mostly for 'pill' or 'custom' buttons) */
  width?: number | string;
  /** Glow halo asset type: 'button' (standard) | 'mini' (options) | 'play' (large play) | 'none' */
  glowType?: "button" | "mini" | "play" | "none";
  /** The color of the glowing halo (defaults to the theme's active accent) */
  glowColor?: string;
  /** Glass style: 'glass' (translucent HSL) | 'transparent' (border only) | 'delete' (red glass) */
  bgType?: "glass" | "transparent" | "delete";
  /** Styles to apply to the outer wrapper (holds the absolute glow positioning) */
  containerStyle?: StyleProp<ViewStyle>;
  /** Styles to apply to the touchable area itself */
  buttonStyle?: StyleProp<ViewStyle>;
  /** Optional custom dimensions for the background glow image */
  glowWidth?: number | string;
  glowHeight?: number | string;
}
